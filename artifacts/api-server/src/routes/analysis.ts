import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable, usersTable, teamsTable, auditLogsTable } from "@workspace/db";
import type { ImportantDate, ClauseItem } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { analysisLimiter } from "../lib/rate-limit.js";

const router = Router();

const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 20, premium: 999, team: 999 };

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function getGroqClient() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey });
}

type RenegotiationItem = {
  clauseName: string;
  problem: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
};

type AnalysisResult = {
  summary: string;
  risks: string[];
  key_clauses: string[];
  renegotiation?: RenegotiationItem[];
  riskScore: number;
  riskCategory: string;
  contractType: string | null;
  parties: string[];
  jurisdiction: string | null;
  importantDates: ImportantDate[];
  clauses: ClauseItem[];
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", ar: "Arabic", zh: "Chinese (Simplified)", hi: "Hindi", ja: "Japanese",
};

function categorizeScore(score: number): string {
  if (score >= 80) return "Low Risk";
  if (score >= 50) return "Moderate";
  if (score >= 20) return "High";
  return "Extreme";
}

function buildSystemPrompt(plan: string, language?: string): string {
  const langName = language && language !== "en" ? LANGUAGE_NAMES[language] ?? "English" : "";
  const langInstruction = langName ? `\n\nIMPORTANT: You MUST write ALL human-readable text values (summary, risks, key_clauses, renegotiation fields, clause titles/explanations/riskReasons, importantDates descriptions) in ${langName}. Names of parties, dates (ISO format), jurisdictions, and contract type may stay in original form when appropriate.` : "";

  const sharedJsonShape = `{
  "summary": "string",
  "risks": ["string"],
  "key_clauses": ["string"],
  "renegotiation": [{ "clauseName": "string", "problem": "string", "suggestion": "string", "severity": "low" | "medium" | "high" }],
  "riskScore": 0-100,
  "contractType": "string e.g. NDA, Employment, SaaS Subscription, Lease",
  "parties": ["string"],
  "jurisdiction": "string e.g. California, USA",
  "importantDates": [{ "date": "YYYY-MM-DD or descriptive", "description": "string" }],
  "clauses": [{ "id": "string", "title": "string", "text": "string (the actual clause text, max 400 chars)", "explanation": "string (plain English)", "riskLevel": "safe" | "caution" | "risky", "riskReason": "string" }]
}`;

  const clausesRule = `- "clauses": 5–12 items. For each clause: id (e.g. "c1"), title (short name), text (excerpt of original wording, max 400 chars), explanation (plain English meaning), riskLevel (safe/caution/risky), riskReason (one sentence).`;

  const datesRule = `- "importantDates": ALL dates that matter — effective date, termination date, payment deadlines, renewal dates, notice periods. Empty array if none.`;
  const typeRule = `- "contractType", "parties", "jurisdiction": always populate from the document. Use "Unknown" / [] / null only if truly absent.`;
  const scoreRule = `- "riskScore": integer 0–100 (0 = catastrophic, 100 = extremely safe). Base on severity, count, and one-sidedness of risks.`;

  if (plan === "free") {
    return `You are a legal document scanner. Identify the NAMES and LOCATIONS of risk clauses and key provisions only. Do NOT explain or give advice in summary/risks/key_clauses fields. However, the structured fields (clauses[], importantDates[], contractType, parties, jurisdiction, riskScore) MUST still be populated — they are needed for the basic UI.

Respond ONLY with a valid JSON object in this exact shape:
${sharedJsonShape}

Rules:
- "summary": 1–2 sentences. State only what type of document this is and who the parties are.
- "risks": 3–6 items. Format: "[Section X.X] — [Risk Name]" — name only, no explanation.
- "key_clauses": 3–5 items. Format: "[Section X.X] — [Clause Name]" — name only.
- "renegotiation": [] (empty array — locked feature for free plan).
${clausesRule}
${datesRule}
${typeRule}
${scoreRule}
- Respond with valid JSON only — no markdown.${langInstruction}`;
  }

  if (plan === "pro") {
    return `You are a senior legal analyst. Produce thorough, professional analysis for business clients.

Respond ONLY with a valid JSON object in this exact shape:
${sharedJsonShape}

Guidelines:
- "summary": 3–5 sentences. What it is, parties, purpose, overall risk posture.
- "risks": 5–8 items. Format: "[Section X.X — Clause Name]: [Plain-English risk explanation with WHY it matters and specific consequences]".
- "key_clauses": 5–8 items. Format: "[Section X.X — Clause Name]: [Plain-English meaning + practical impact]".
- "renegotiation": 3–6 items. Each item is an object: clauseName (the clause), problem (what's wrong), suggestion (specific change to request), severity (low/medium/high).
${clausesRule}
${datesRule}
${typeRule}
${scoreRule}
- Respond with valid JSON only — no markdown.${langInstruction}`;
  }

  // premium / team
  return `You are ContractAI's most advanced legal analyst — equivalent to a senior partner at a top law firm. Produce the most comprehensive analysis possible.

Respond ONLY with a valid JSON object in this exact shape:
${sharedJsonShape}

Guidelines:
- "summary": 4–6 sentences. What it is, parties, purpose, overall risk posture, and one critical observation the signing party must know immediately.
- "risks": 6–10 items. Format: "[Section X.X — Clause Name]: [Detailed plain-English explanation with dollar exposure, time periods, legal consequences]".
- "key_clauses": 5–8 items with full plain-English explanation of practical impact.
- "renegotiation": 4–7 items. Each is an object: clauseName, problem, suggestion (specific actionable amendment), severity (low/medium/high). Cover payment terms, liability caps, IP, termination, non-compete, auto-renewal, jurisdiction, indemnification where applicable.
${clausesRule}
${datesRule}
${typeRule}
${scoreRule}
- Respond with valid JSON only — no markdown.${langInstruction}`;
}

function coerceClauses(raw: unknown): ClauseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const rl = String(o["riskLevel"] ?? "safe").toLowerCase();
    return {
      id: String(o["id"] ?? `c${i + 1}`),
      title: String(o["title"] ?? `Clause ${i + 1}`),
      text: String(o["text"] ?? "").slice(0, 600),
      explanation: String(o["explanation"] ?? ""),
      riskLevel: (rl === "risky" || rl === "caution" || rl === "safe") ? rl as "safe" | "caution" | "risky" : "safe",
      riskReason: String(o["riskReason"] ?? ""),
    };
  });
}

function coerceDates(raw: unknown): ImportantDate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((d) => {
    const o = (d ?? {}) as Record<string, unknown>;
    return {
      date: String(o["date"] ?? ""),
      description: String(o["description"] ?? ""),
    };
  }).filter((d) => d.date && d.description);
}

function coerceRenegotiation(raw: unknown): RenegotiationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const sev = String(o["severity"] ?? "medium").toLowerCase();
    return {
      clauseName: String(o["clauseName"] ?? "Clause"),
      problem: String(o["problem"] ?? ""),
      suggestion: String(o["suggestion"] ?? ""),
      severity: (sev === "high" || sev === "low" || sev === "medium") ? sev as "low" | "medium" | "high" : "medium",
    };
  }).filter((r) => r.problem || r.suggestion);
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
    temperature: 0.1,
    max_tokens: plan === "free" ? 2500 : 5000,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("GROQ returned empty content — no message in choices[0]");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (jsonErr) {
    throw new Error(`GROQ response was not valid JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
  }

  const rawScore = Number(parsed["riskScore"]);
  const riskScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 50;

  const result: AnalysisResult = {
    summary: typeof parsed["summary"] === "string" && (parsed["summary"] as string).trim()
      ? parsed["summary"] as string
      : "Summary not available — the document may not be a standard contract.",
    risks: Array.isArray(parsed["risks"]) && (parsed["risks"] as unknown[]).length > 0
      ? (parsed["risks"] as unknown[]).map(String)
      : ["No significant risks identified in the provided text."],
    key_clauses: Array.isArray(parsed["key_clauses"]) && (parsed["key_clauses"] as unknown[]).length > 0
      ? (parsed["key_clauses"] as unknown[]).map(String)
      : ["No key clauses identified in the provided text."],
    riskScore,
    riskCategory: categorizeScore(riskScore),
    contractType: typeof parsed["contractType"] === "string" ? parsed["contractType"] as string : null,
    parties: Array.isArray(parsed["parties"]) ? (parsed["parties"] as unknown[]).map(String).slice(0, 10) : [],
    jurisdiction: typeof parsed["jurisdiction"] === "string" ? parsed["jurisdiction"] as string : null,
    importantDates: coerceDates(parsed["importantDates"]),
    clauses: coerceClauses(parsed["clauses"]),
  };

  // Negotiation suggestions: Pro + Premium only (excluded for free and team plans)
  if (plan === "pro" || plan === "premium" || plan === "team") {
    const reneg = coerceRenegotiation(parsed["renegotiation"]);
    if (reneg.length > 0) result.renegotiation = reneg;
  }

  return result;
}

function calculateRiskLevelFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "low";
  if (score >= 40) return "medium";
  return "high";
}

router.post("/:id/analyze", requireAuth, analysisLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const { language = "en" } = (req.body ?? {}) as { language?: string };
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

    let team: typeof teamsTable.$inferSelect | undefined;
    if (user.plan === "team") {
      if (user.teamId) {
        const teamRows = await db.select().from(teamsTable).where(eq(teamsTable.id, user.teamId)).limit(1);
        team = teamRows[0];
      }
      // Team plan = unlimited scans per user (same as Premium). No shared-pool enforcement.
    } else if (user.plan !== "premium") {
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
        source: "AI", contractId: id, model: "llama-3.3-70b-versatile",
        plan: user.plan, charCount: extractedText.length,
      }, `AI: sending contract to GROQ [${user.plan} plan]`);

      analysisResult = await analyzeWithGroq(extractedText, user.plan, language);

      req.log.info({
        source: "AI", contractId: id, plan: user.plan,
        riskCount: analysisResult.risks.length,
        clauseCount: analysisResult.key_clauses.length,
        clauseBreakdownCount: analysisResult.clauses.length,
        riskScore: analysisResult.riskScore,
        contractType: analysisResult.contractType,
      }, "AI: GROQ analysis complete");
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      req.log.error({
        error: true, source: "AI", message: "GROQ AI analysis failed",
        details: errMsg, stack: aiErr instanceof Error ? aiErr.stack : undefined,
        contractId: id,
      }, "AI: GROQ error");
      await db.update(contractsTable).set({ status: "failed" }).where(eq(contractsTable.id, id));
      res.status(500).json(structuredError("AI", "AI analysis failed — please try again", errMsg));
      return;
    }

    const riskLevel = calculateRiskLevelFromScore(analysisResult.riskScore);
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
      riskScore: analysisResult.riskScore,
      riskCategory: analysisResult.riskCategory,
      contractType: analysisResult.contractType,
      parties: analysisResult.parties,
      jurisdiction: analysisResult.jurisdiction,
      importantDates: analysisResult.importantDates,
      clauses: analysisResult.clauses,
    }).returning();

    // PRIVACY: Clear extracted text immediately after AI analysis — never retain full document content
    await db.update(contractsTable)
      .set({ status: "analyzed", analyzedAt: new Date(), extractedText: null })
      .where(eq(contractsTable.id, id));

    if (user.plan === "team" && team) {
      await db.update(teamsTable)
        .set({ scansUsed: team.scansUsed + 1 })
        .where(eq(teamsTable.id, team.id));
    } else if (user.plan !== "premium") {
      const newContractsUsed = user.contractsUsed + 1;
      const updateData: Record<string, unknown> = { contractsUsed: newContractsUsed };

      if (newContractsUsed === 15) {
        updateData.bonusScans = (user.bonusScans ?? 0) + 4;
        req.log.info({ source: "REWARD", userId: req.userId, bonus: 4 }, "Scan reward: +4 bonus scans for reaching 15 analyses this month");
      }

      await db.update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, req.userId!));
    }

    // Write to audit log (best-effort — never block response)
    try {
      await db.insert(auditLogsTable).values({
        id: uuidv4(),
        userId: req.userId!,
        action: "analyze",
        contractId: id,
        riskScore: analysisResult.riskScore,
        contractType: analysisResult.contractType,
        metadata: {
          riskScore: analysisResult.riskScore,
          riskCategory: analysisResult.riskCategory,
          contractType: analysisResult.contractType,
          filename: contract.filename,
          contractId: id,
        },
      });
    } catch (auditErr) {
      req.log.warn({ source: "AUDIT", details: auditErr instanceof Error ? auditErr.message : String(auditErr) }, "Audit: log write failed");
    }

    req.log.info({
      source: "AI", contractId: id, riskLevel, analysisId,
      plan: user.plan,
    }, "AI: analysis complete — extracted text purged, credit charged");

    res.json(analysis);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true, source: "SYSTEM", message: "Unexpected error in analysis route",
      details: errMsg, stack: err instanceof Error ? err.stack : undefined,
      contractId: id,
    }, "Analysis: unhandled exception");
    res.status(500).json(structuredError("SYSTEM", "Analysis failed", errMsg));
  }
});

export default router;
