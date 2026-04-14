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

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function getGroqClient() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey });
}

async function analyzeWithGroq(text: string): Promise<{
  summary: string;
  risks: string[];
  key_clauses: string[];
}> {
  const groq = getGroqClient();
  const truncatedText = text.slice(0, 14000);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a senior legal analyst at a top-tier law firm. Your role is to produce a clear, accurate, and professional review of contracts for business clients who are not lawyers.

Analyze the provided contract text and respond ONLY with a valid JSON object in this exact structure:
{
  "summary": "string",
  "risks": ["string", "string", ...],
  "key_clauses": ["string", "string", ...]
}

Guidelines:
- "summary": 2–4 sentences. Explain in plain English what the contract is, who the parties are, and its primary purpose. Avoid all legal jargon.
- "risks": 4–7 items. Each risk must be specific, actionable, and explain WHY it is a risk to the signing party. Format each as: "[Clause/Topic]: [What the risk is and why it matters]". Cover financial exposure, IP ownership, termination conditions, liability caps, non-compete/non-solicitation clauses, auto-renewal traps, and jurisdiction risks where present.
- "key_clauses": 4–8 items. Identify the most important provisions the reader must understand. For each: "[Clause name]: [Plain-English explanation of what it means and its practical impact]".
- Be specific — reference actual dollar amounts, time periods, and party names from the contract where available.
- If the document does not appear to be a contract (e.g., it is a form, letter, or unrelated text), still provide the best analysis you can based on what is present.
- Respond with valid JSON only — no markdown fences, no extra text.`,
      },
      {
        role: "user",
        content: `Please analyze the following contract:\n\n${truncatedText}`,
      },
    ],
    temperature: 0.05,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("GROQ returned empty content — no message in choices[0]");

  let parsed: { summary?: string; risks?: unknown[]; key_clauses?: unknown[] };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch (jsonErr) {
    throw new Error(`GROQ response was not valid JSON: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
  }

  return {
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
}

function calculateRiskLevel(risks: string[]): "low" | "medium" | "high" {
  if (risks.length === 0) return "low";
  const riskText = risks.join(" ").toLowerCase();
  const highRiskWords = [
    "penalty", "liable", "liability", "termination", "forfeit", "forfeit",
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

    const extractedText = contract.extractedText?.trim() ?? "";

    if (!extractedText) {
      req.log.error({
        error: true,
        source: "OCR",
        message: "No extracted text available for this contract",
        details: `contractId=${id}, status=${contract.status}. Text extraction likely failed at upload time.`,
        contractId: id,
      }, "Analysis: no text to analyze");

      res.status(422).json(structuredError(
        "OCR",
        "No text could be extracted from this file. Please delete and re-upload the file, ensuring it is not password-protected.",
        `Contract status: ${contract.status}. Text extraction failed at upload.`
      ));
      return;
    }

    await db.update(contractsTable)
      .set({ status: "analyzing" })
      .where(eq(contractsTable.id, id));

    let analysisResult: { summary: string; risks: string[]; key_clauses: string[] };
    try {
      req.log.info({
        source: "AI",
        contractId: id,
        model: "llama-3.3-70b-versatile",
        charCount: extractedText.length,
      }, "AI: sending contract to GROQ");

      analysisResult = await analyzeWithGroq(extractedText);

      req.log.info({
        source: "AI",
        contractId: id,
        riskCount: analysisResult.risks.length,
        clauseCount: analysisResult.key_clauses.length,
      }, "AI: GROQ analysis complete");
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      req.log.error({
        error: true,
        source: "AI",
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
      riskLevel,
    }).returning();

    await db.update(contractsTable)
      .set({ status: "analyzed", analyzedAt: new Date() })
      .where(eq(contractsTable.id, id));

    req.log.info({ source: "AI", contractId: id, riskLevel, analysisId }, "AI: analysis stored");
    res.json(analysis);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true,
      source: "SYSTEM",
      message: "Unexpected error in analysis route",
      details: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      contractId: id,
    }, "Analysis: unhandled exception");
    res.status(500).json(structuredError("SYSTEM", "Analysis failed", errMsg));
  }
});

export default router;
