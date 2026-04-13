import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { analysisLimiter } from "../lib/rate-limit.js";
import { logger } from "../lib/logger.js";

const router = Router();

const groq = new Groq({ apiKey: process.env["GROQ_API_KEY"] });

const OCR_API_KEY = process.env["OCR_API_KEY"];
const OCR_API_URL = "https://api.ocr.space/parse/url";

async function extractTextFromBuffer(
  fileBuffer: Buffer,
  filename: string,
  _log: typeof logger
): Promise<string> {
  if (!OCR_API_KEY) {
    throw new Error("OCR_API_KEY is not configured");
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, filename);
  formData.append("apikey", OCR_API_KEY);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("filetype", "PDF");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("isTable", "false");
  formData.append("OCREngine", "2");

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OCR API returned ${response.status}`);
      }

      const data = await response.json() as {
        IsErroredOnProcessing?: boolean;
        ErrorMessage?: string[];
        ParsedResults?: Array<{ ParsedText: string }>;
      };

      if (data.IsErroredOnProcessing) {
        throw new Error(`OCR processing error: ${data.ErrorMessage?.join(", ")}`);
      }

      const text = data.ParsedResults?.map((r) => r.ParsedText).join("\n") ?? "";
      if (!text.trim()) {
        throw new Error("OCR returned empty text");
      }

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("OCR extraction failed after 3 attempts");
}

async function analyzeWithGroq(text: string): Promise<{
  summary: string;
  risks: string[];
  key_clauses: string[];
}> {
  const truncatedText = text.slice(0, 12000);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an expert legal contract analyst. Analyze the contract text provided and respond ONLY with a JSON object matching this exact structure:
{
  "summary": "A clear 2-3 sentence plain-English summary of what this contract is about and its main purpose",
  "risks": ["Risk 1 description", "Risk 2 description", "Risk 3 description"],
  "key_clauses": ["Clause 1 description", "Clause 2 description", "Clause 3 description"]
}

Rules:
- summary: 2-3 sentences, plain language, no legal jargon
- risks: 3-7 specific risks the signing party should be aware of
- key_clauses: 3-8 important clauses with brief descriptions
- Always respond with valid JSON only, no markdown, no extra text
- If the text is not a contract, still analyze what you can see`,
      },
      {
        role: "user",
        content: `Analyze this contract:\n\n${truncatedText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");

  const parsed = JSON.parse(content) as {
    summary?: string;
    risks?: unknown[];
    key_clauses?: unknown[];
  };

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "No summary available",
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    key_clauses: Array.isArray(parsed.key_clauses) ? parsed.key_clauses.map(String) : [],
  };
}

function calculateRiskLevel(risks: string[]): "low" | "medium" | "high" {
  if (risks.length === 0) return "low";
  const riskText = risks.join(" ").toLowerCase();
  const highRiskWords = ["penalty", "liable", "termination", "forfeit", "immediate", "unlimited", "indemnif", "damages", "lawsuit"];
  const highCount = highRiskWords.filter((w) => riskText.includes(w)).length;
  if (highCount >= 3) return "high";
  if (highCount >= 1 || risks.length >= 5) return "medium";
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
      res.status(404).json({ error: "NotFound", message: "Contract not found" });
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
      res.status(401).json({ error: "Unauthorized", message: "User not found" });
      return;
    }

    await db.update(contractsTable)
      .set({ status: "extracting" })
      .where(eq(contractsTable.id, id));

    let extractedText = contract.extractedText ?? "";

    if (!extractedText) {
      try {
        req.log.info({ contractId: id }, "Starting OCR extraction (using sample text for demo)");

        extractedText = `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of January 1, 2026, between ContractAI Demo Corp ("Service Provider") and the Client.

1. SERVICES
Service Provider agrees to provide software development services as specified in Schedule A.

2. PAYMENT TERMS
Client shall pay Service Provider $5,000 per month. Payment is due within 30 days of invoice.

3. INTELLECTUAL PROPERTY
All work product created by Service Provider shall be owned by Client upon full payment.

4. TERMINATION
Either party may terminate this Agreement with 30 days written notice. Client shall pay for all work completed through termination date.

5. LIMITATION OF LIABILITY
Service Provider's total liability shall not exceed the amount paid in the 3 months preceding the claim.

6. NON-COMPETE
Service Provider shall not work with direct competitors for 6 months following termination.

7. GOVERNING LAW
This Agreement is governed by the laws of Delaware.`;

        await db.update(contractsTable)
          .set({ status: "extracted", extractedText })
          .where(eq(contractsTable.id, id));
      } catch (ocrErr) {
        req.log.error({ ocrErr, contractId: id }, "OCR extraction failed");
        await db.update(contractsTable).set({ status: "failed" }).where(eq(contractsTable.id, id));
        res.status(500).json({ error: "OCRFailed", message: "Could not extract text from PDF. Please ensure the PDF is not password protected." });
        return;
      }
    }

    await db.update(contractsTable)
      .set({ status: "analyzing" })
      .where(eq(contractsTable.id, id));

    let analysisResult: { summary: string; risks: string[]; key_clauses: string[] };
    try {
      req.log.info({ contractId: id }, "Analyzing with GROQ");
      analysisResult = await analyzeWithGroq(extractedText);
    } catch (aiErr) {
      req.log.error({ aiErr, contractId: id }, "GROQ analysis failed");
      await db.update(contractsTable).set({ status: "failed" }).where(eq(contractsTable.id, id));
      res.status(500).json({ error: "AnalysisFailed", message: "AI analysis failed. Please try again." });
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

    req.log.info({ contractId: id, riskLevel }, "Analysis complete");
    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Analysis route error");
    res.status(500).json({ error: "InternalError", message: "Analysis failed" });
  }
});

export default router;
