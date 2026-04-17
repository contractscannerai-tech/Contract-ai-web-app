import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { analysisLimiter } from "../lib/rate-limit.js";

const router = Router();

const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 20, premium: 999 };

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function getGroqClient() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey });
}

type AnalysisResult = {
  summary: string;
  risks: string[];
  key_clauses: string[];
  renegotiation?: string[];
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", ar: "Arabic", zh: "Chinese (Simplified)", hi: "Hindi", ja: "Japanese",
};

function buildSystemPrompt(plan: string, language?: string): string {
  const langName = language && language !== "en" ? LANGUAGE_NAMES[language] ?? "English" : "";
  const langInstruction = langName ? `\n\nIMPORTANT: You MUST write ALL text values (summary, risks, key_clauses, renegotiation) in ${langName}. Do not use English for any text content.` : "";

  if (plan === "free") {
    return `You are a legal document scanner. Your ONLY job is to identify the NAMES and LOCATIONS of risk clauses — nothing more.

You MUST NOT explain risks. You MUST NOT give advice. You MUST NOT describe what a clause means. Simply identify where risk clauses exist.

Respond ONLY with a valid JSON object in this exact structure:
{
  "summary": "string",
  "risks": ["string", "string", ...],
  "key_clauses": ["string", "string", ...]
}

Rules (strictly enforced):
- "summary": 1–2 sentences. State only what type of document this is and who the parties are. Nothing else.
- "risks": 3–6 items. Each item must follow this format EXACTLY: "[Section/Clause Reference] — [Risk Name]". Example: "Section 4.2 — Termination Without Cause". Do NOT explain the risk. Do NOT say why it matters. Name only.
- "key_clauses": 3–5 items. Each item must follow this format EXACTLY: "[Section/Clause Reference] — [Clause Name]". Example: "Section 7.1 — Non-Compete Clause". Name and location only. No explanations.
- Respond with valid JSON only — no markdown, no extra text, no advice.${langInstruction}`;
  }

  if (plan === "pro") {
    return `You are a senior legal analyst at a top-tier law firm. Your role is to produce clear, thorough, professional risk analysis for business clients who are not lawyers.

Analyze the provided contract text and respond ONLY with a valid JSON object in this exact structure:
{
  "summary": "string",
  "risks": ["string", "string", ...],
  "key_clauses": ["string", "string", ...]
}

Guidelines:
- "summary": 3–5 sentences in plain English. Explain what the contract is, who the parties are, the primary purpose, and the overall risk posture.
- "risks": 5–8 items. For each risk you MUST:
  - Name the clause and its section reference
  - Explain in simple, professional English exactly what the risk is
  - Explain WHY it is dangerous to the signing party with specific consequences
  - Reference actual dollar amounts, time periods, and party names from the contract where available
  - Format: "[Section X.X — Clause Name]: [Plain-English explanation of the risk and why it matters to the signing party]"
- "key_clauses": 5–8 items. Identify the most important provisions. For each:
  - Name the clause and location
  - Explain in plain English what it means and its practical impact
  - Format: "[Section X.X — Clause Name]: [Plain-English explanation of what this means and its real-world impact]"
- Be specific, thorough, and educational. The user is paying for expert analysis, not vague labels.
- Respond with valid JSON only — no markdown fences, no extra text.${langInstruction}`;
  }

  return `You are ContractAI's most advanced legal analyst — the equivalent of a senior partner at a top law firm combined with a skilled negotiator. Produce the most comprehensive contract analysis possible.

Analyze the provided contract text and respond ONLY with a valid JSON object in this exact structure:
{
  "summary": "string",
  "risks": ["string", "string", ...],
  "key_clauses": ["string", "string", ...],
  "renegotiation": ["string", "string", ...]
}

Guidelines:
- "summary": 4–6 sentences. Cover: what the contract is, parties involved, primary purpose, overall risk posture, and one key observation the signing party must know immediately.
- "risks": 6–10 items. For each risk:
  - Reference the exact section/clause
  - Explain in plain English what the risk is and the specific harm it could cause
  - Include dollar exposure, time commitments, or legal consequences where present
  - Format: "[Section X.X — Clause Name]: [Detailed explanation with specific consequences and why this matters most]"
- "key_clauses": 5–8 items. Most important provisions with plain-English explanation of practical impact.
  - Format: "[Section X.X — Clause Name]: [Explanation of what this means and how it affects the signing party day-to-day]"
- "renegotiation": 4–7 actionable renegotiation recommendations the signing party should request before signing.
  - Each recommendation must be specific and directly tied to a clause in this contract
  - Format: "[Clause/Topic]: [Specific change to request — e.g., 'Request that Section 4.2 be amended to require 30 days written notice instead of immediate termination']"
  - Cover: payment terms, liability caps, IP ownership, termination notice, non-compete scope/duration, auto-renewal opt-out, jurisdiction, and indemnification where applicable
- Respond with valid JSON only — no markdown fences, no extra text.${langInstruction}`;
}

async function analyzeWithGroq(text: string, plan: string, language?: string): Promise<AnalysisResult> {
  const groq = getGroqClient();
  const truncatedText = text.slice(0, 14000);
  const systemPrompt = buildSystemPrompt(plan, language);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please analyze the following contract:\n\n${truncatedText}` },
    ],
    temperature: 0.05,
    max_tokens: plan === "free" ? 1200 : 3000,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("GROQ returned empty content — no message in choices[0]");

  let parsed: { summary?: string; risks?: unknown[]; key_clauses?: unknown[]; renegotiation?: unknown[] };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch (jsonErr) {
    throw new Error(`GROQ response was not valid JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
  }

  const result: AnalysisResult = {
    summary: typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary
      : "Summary not available — the document may not be a standard contract.",
    risks: Array.isArray(parsed.risks) && parsed.risks.length > 0
      ? parsed.risks.map(String)
      : ["No significant risks identified in the provided text."],
    key_clauses: Array.isArray(parsed.key_clauses) && parsed.key_clauses.length > 0
      ? parsed.key_clauses.map(String)
      : ["No key clauses identified in the provided text."],
  };

  if (plan === "premium" && Array.isArray(parsed.renegotiation) && parsed.renegotiation.length > 0) {
    result.renegotiation = parsed.renegotiation.map(String);
  }

  return result;
}

function calculateRiskLevel(risks: string[]): "low" | "medium" | "high" {
  if (risks.length === 0) return "low";
  const riskText = risks.join(" ").toLowerCase();
  const highRiskWords = [
    "penalty", "liable", "liability", "termination", "forfeit",
    "immediate", "unlimited", "indemnif", "damages", "lawsuit", "litigation",
    "sue", "court", "jurisdiction", "arbitration", "injunction", "breach",
  ];
  const mediumRiskWords = [
    "auto-renew", "automatic renewal", "non-compete", "non-solicitation",
    "confidential", "intellectual property", "ip ownership", "exclusiv",
    "restrict", "prohibit", "waive",
  ];
  const highCount = highRiskWords.filter((w) => riskText.includes(w)).length;
  const mediumCount = mediumRiskWords.filter((w) => riskText.includes(w)).length;

  if (highCount >= 2) return "high";
  if (highCount >= 1 || mediumCount >= 2 || risks.length >= 5) return "medium";
  return "low";
}

router.post("/:id/analyze", requireAuth, analysisLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { language } = req.body as { language?: string };

  try {
    const contracts = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, req.userId!)))
      .limit(1);

    if (contracts.length === 0) {
      res.status(404).json(structuredError("SYSTEM", "Contract not found", `contractId=${id} userId=${req.userId}`));
      return;
    }

    const contract = contracts[0];

    if (contract.status === "analyzed") {
      const existing = await db.select().from(analysesTable).where(eq(analysesTable.contractId, id)).limit(1);
      if (existing.length > 0) {
        res.json(existing[0]);
        return;
      }
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json(structuredError("AUTH", "User not found — session may be invalid", `userId=${req.userId}`));
      return;
    }

    const baseLimit = PLAN_LIMITS[user.plan] ?? 3;
    const limit = baseLimit + (user.bonusScans ?? 0);
    if (user.contractsUsed >= limit) {
      res.status(403).json(structuredError(
        "PLAN",
        `Your ${user.plan} plan allows ${limit} contract analysis${limit === 1 ? "" : "es"} per month. Please upgrade to analyze more.`,
        `contractsUsed=${user.contractsUsed} limit=${limit} plan=${user.plan}`
      ));
      return;
    }

    const extractedText = contract.extractedText?.trim() ?? "";

    if (!extractedText) {
      req.log.error({
        error: true, source: "EXTRACTION",
        message: "No extracted text available for this contract",
        details: `contractId=${id}, status=${contract.status}. Text extraction likely failed at upload time.`,
        contractId: id,
      }, "Analysis: no text to analyze");

      res.status(422).json(structuredError(
        "EXTRACTION",
        "No text could be extracted from this file. Please delete it and re-upload, making sure the file is not password-protected or corrupted.",
        `Contract status: ${contract.status}. Text extraction failed at upload.`
      ));
      return;
    }

    await db.update(contractsTable)
      .set({ status: "analyzing" })
      .where(eq(contractsTable.id, id));

    let analysisResult: AnalysisResult;
    try {
      req.log.info({
        source: "AI",
        contractId: id,
        model: "llama-3.3-70b-versatile",
        plan: user.plan,
        charCount: extractedText.length,
      }, `AI: sending contract to GROQ [${user.plan} plan]`);

      analysisResult = await analyzeWithGroq(extractedText, user.plan, language);

      req.log.info({
        source: "AI",
        contractId: id,
        plan: user.plan,
        riskCount: analysisResult.risks.length,
        clauseCount: analysisResult.key_clauses.length,
        hasRenegotiation: !!analysisResult.renegotiation,
      }, "AI: GROQ analysis complete");
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      req.log.error({
        error: true, source: "AI",
        message: "GROQ AI analysis failed",
        details: errMsg,
        stack: aiErr instanceof Error ? aiErr.stack : undefined,
        contractId: id,
      }, "AI: GROQ error");
      await db.update(contractsTable).set({ status: "failed" }).where(eq(contractsTable.id, id));
      res.status(500).json(structuredError("AI", "AI analysis failed — please try again", errMsg));
      return;
    }

    const riskLevel = calculateRiskLevel(analysisResult.risks);
    const analysisId = uuidv4();

    await db.delete(analysesTable).where(eq(analysesTable.contractId, id));

    const [analysis] = await db.insert(analysesTable).values({
      id: analysisId,
      contractId: id,
      summary: analysisResult.summary,
      risks: analysisResult.risks,
      keyClauses: analysisResult.key_clauses,
      renegotiation: analysisResult.renegotiation ?? null,
      riskLevel,
    }).returning();

    // PRIVACY: Clear extracted text immediately after AI analysis — never retain full document content
    await db.update(contractsTable)
      .set({ status: "analyzed", analyzedAt: new Date(), extractedText: null })
      .where(eq(contractsTable.id, id));

    const newContractsUsed = user.contractsUsed + 1;
    const updateData: Record<string, unknown> = { contractsUsed: newContractsUsed };

    if (newContractsUsed === 15) {
      updateData.bonusScans = (user.bonusScans ?? 0) + 4;
      req.log.info({ source: "REWARD", userId: req.userId, bonus: 4 }, "Scan reward: +4 bonus scans for reaching 15 analyses this month");
    }

    await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, req.userId!));

    req.log.info({
      source: "AI", contractId: id, riskLevel, analysisId,
      plan: user.plan, creditsUsed: newContractsUsed,
    }, "AI: analysis complete — extracted text purged, credit charged");

    res.json(analysis);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true, source: "SYSTEM",
      message: "Unexpected error in analysis route",
      details: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      contractId: id,
    }, "Analysis: unhandled exception");
    res.status(500).json(structuredError("SYSTEM", "Analysis failed", errMsg));
  }
});

export default router;
