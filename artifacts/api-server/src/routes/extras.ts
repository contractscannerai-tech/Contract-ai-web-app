import { Router } from "express";
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const ASK_LIMITS: Record<string, number> = { free: 3, pro: 20, premium: 999, team: 999 };

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", ar: "Arabic", zh: "Chinese (Simplified)", hi: "Hindi", ja: "Japanese",
};

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function getGroq() {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: key });
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

// =====================================================
// FEATURE 6: Ask Your Contract — daily rate-limited Q&A
// =====================================================
router.post("/analysis/:id/ask", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { question, language } = req.body as { question?: string; language?: string };

  if (!question || !question.trim()) {
    res.status(400).json(structuredError("VALIDATION", "Question is required", "empty body.question"));
    return;
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json(structuredError("AUTH", "User not found", `userId=${req.userId}`));
      return;
    }

    const now = new Date();
    let askUsed = user.askQuestionsUsed ?? 0;
    if (!isSameUtcDay(user.askResetAt, now)) {
      askUsed = 0;
    }

    const limit = ASK_LIMITS[user.plan] ?? 3;
    const isUnlimited = user.plan === "premium" || user.plan === "team";
    if (!isUnlimited && askUsed >= limit) {
      res.status(403).json(structuredError(
        "PLAN",
        `Daily limit reached. Your ${user.plan} plan allows ${limit} questions per day. Resets at midnight UTC or upgrade for more.`,
        `askQuestionsUsed=${askUsed} limit=${limit}`
      ));
      return;
    }

    const contracts = await db.select().from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, req.userId!)))
      .limit(1);
    if (contracts.length === 0) {
      res.status(404).json(structuredError("SYSTEM", "Contract not found", `contractId=${id}`));
      return;
    }
    const contract = contracts[0];

    const analyses = await db.select().from(analysesTable).where(eq(analysesTable.contractId, id)).limit(1);
    const analysis = analyses[0];

    if (!analysis) {
      res.status(422).json(structuredError("VALIDATION", "Contract has not been analyzed yet — analyze it first", `contractId=${id}`));
      return;
    }

    const langName = language && language !== "en" ? LANGUAGE_NAMES[language] ?? "" : "";
    const langRule = langName ? `\nIMPORTANT: You MUST answer entirely in ${langName}.` : "";

    const contextParts: string[] = [
      `Contract: "${contract.filename}"`,
      `Type: ${analysis.contractType ?? "Unknown"}`,
      `Parties: ${(analysis.parties ?? []).join(", ") || "Unknown"}`,
      `Jurisdiction: ${analysis.jurisdiction ?? "Unknown"}`,
      `Risk Score: ${analysis.riskScore}/100 (${analysis.riskCategory})`,
      `Summary: ${analysis.summary}`,
      `Key Risks: ${analysis.risks.join(" | ")}`,
      `Key Clauses: ${analysis.keyClauses.join(" | ")}`,
    ];
    if (analysis.clauses && analysis.clauses.length > 0) {
      contextParts.push(`Clause-by-clause excerpts:\n${analysis.clauses.map((c) => `- ${c.title}: ${c.text}`).join("\n")}`);
    }

    const systemPrompt = `You are ContractAI's Q&A assistant. Answer questions ONLY using the contract context below. If the answer is not in the contract, say "That information isn't covered in this contract." Do not invent terms or speculate. Keep answers concise (2–6 sentences) and in plain English. Add a brief disclaimer to consult a licensed attorney for important decisions.${langRule}

CONTRACT CONTEXT:
${contextParts.join("\n\n")}`;

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question.trim() },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "I could not generate a response. Please try again.";

    await db.update(usersTable)
      .set({ askQuestionsUsed: askUsed + 1, askResetAt: isSameUtcDay(user.askResetAt, now) ? user.askResetAt : now })
      .where(eq(usersTable.id, req.userId!));

    req.log.info({ source: "AI", feature: "ASK", contractId: id, plan: user.plan, used: askUsed + 1 }, "Ask: answer generated");

    res.json({
      answer,
      questionsUsedToday: askUsed + 1,
      dailyLimit: isUnlimited ? null : limit,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "AI", message: "Ask failed", details: msg, contractId: id }, "Ask: error");
    res.status(500).json(structuredError("AI", "Failed to answer question", msg));
  }
});

// =====================================================
// FEATURE 4 PART B: PDF Export (Pro + Premium + Team)
// =====================================================
router.post("/analysis/:id/export-pdf", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  if (req.userPlan === "free") {
    res.status(403).json(structuredError("PLAN", "PDF export requires Pro or Legal Partner plan", `plan=${req.userPlan}`));
    return;
  }

  try {
    const contracts = await db.select().from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, req.userId!)))
      .limit(1);
    if (contracts.length === 0) {
      res.status(404).json(structuredError("SYSTEM", "Contract not found", `contractId=${id}`));
      return;
    }
    const contract = contracts[0];

    const analyses = await db.select().from(analysesTable).where(eq(analysesTable.contractId, id)).limit(1);
    const analysis = analyses[0];
    if (!analysis) {
      res.status(422).json(structuredError("VALIDATION", "Contract has not been analyzed", `contractId=${id}`));
      return;
    }

    const safeName = contract.filename.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 80);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ContractAI-Report-${safeName}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // Header
    doc.fillColor("#4f46e5").fontSize(24).text("ContractAI", { align: "left" });
    doc.fillColor("#6b7280").fontSize(10).text("Contract Analysis Report", { align: "left" });
    doc.moveDown();
    doc.fillColor("#111827").fontSize(16).text(contract.filename);
    doc.fillColor("#6b7280").fontSize(10).text(`Generated: ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`);
    doc.moveDown();

    // Risk Score Box
    const scoreColor = analysis.riskScore >= 80 ? "#16a34a" : analysis.riskScore >= 50 ? "#ca8a04" : analysis.riskScore >= 20 ? "#ea580c" : "#dc2626";
    doc.rect(50, doc.y, 495, 60).fillAndStroke(scoreColor, scoreColor);
    doc.fillColor("white").fontSize(28).text(`${analysis.riskScore}/100`, 60, doc.y - 50, { width: 200 });
    doc.fontSize(14).text(analysis.riskCategory, 60, doc.y - 20);
    doc.fontSize(10).text(`${analysis.risks.length} risks · ${analysis.keyClauses.length} key clauses`, 280, doc.y - 25, { width: 250, align: "right" });
    doc.fillColor("#111827").moveDown(3);

    // Metadata
    doc.fontSize(11).fillColor("#374151");
    if (analysis.contractType) doc.text(`Contract Type: ${analysis.contractType}`);
    if (analysis.parties && analysis.parties.length > 0) doc.text(`Parties: ${analysis.parties.join(", ")}`);
    if (analysis.jurisdiction) doc.text(`Jurisdiction: ${analysis.jurisdiction}`);
    doc.moveDown();

    // Summary
    doc.fontSize(14).fillColor("#111827").text("Summary", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#374151").text(analysis.summary, { align: "justify" });
    doc.moveDown();

    // Risks
    doc.fontSize(14).fillColor("#dc2626").text(`Risk Alerts (${analysis.risks.length})`, { underline: true });
    doc.moveDown(0.3);
    analysis.risks.forEach((r, i) => {
      doc.fontSize(10).fillColor("#374151").text(`${i + 1}. ${r}`, { align: "left" });
      doc.moveDown(0.2);
    });
    doc.moveDown();

    // Key Clauses
    doc.fontSize(14).fillColor("#16a34a").text(`Key Clauses (${analysis.keyClauses.length})`, { underline: true });
    doc.moveDown(0.3);
    analysis.keyClauses.forEach((c, i) => {
      doc.fontSize(10).fillColor("#374151").text(`${i + 1}. ${c}`, { align: "left" });
      doc.moveDown(0.2);
    });

    // Important Dates
    if (analysis.importantDates && analysis.importantDates.length > 0) {
      doc.moveDown();
      doc.fontSize(14).fillColor("#0891b2").text(`Important Dates (${analysis.importantDates.length})`, { underline: true });
      doc.moveDown(0.3);
      analysis.importantDates.forEach((d) => {
        doc.fontSize(10).fillColor("#374151").text(`${d.date} — ${d.description}`);
      });
    }

    // Renegotiation
    if (analysis.renegotiation && analysis.renegotiation.length > 0) {
      doc.moveDown();
      doc.fontSize(14).fillColor("#2563eb").text(`Renegotiation Recommendations (${analysis.renegotiation.length})`, { underline: true });
      doc.moveDown(0.3);
      analysis.renegotiation.forEach((r, i) => {
        doc.fontSize(11).fillColor("#111827").text(`${i + 1}. ${r.clauseName} [${r.severity.toUpperCase()}]`);
        doc.fontSize(10).fillColor("#dc2626").text(`Problem: ${r.problem}`);
        doc.fontSize(10).fillColor("#16a34a").text(`Suggestion: ${r.suggestion}`);
        doc.moveDown(0.5);
      });
    }

    // Footer disclaimer
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#9ca3af").text(
      "This report is generated by AI and is provided for informational purposes only. It is not legal advice. " +
      "Always consult a licensed attorney for important contract decisions.",
      { align: "center" }
    );

    doc.end();
    req.log.info({ source: "PDF", contractId: id, plan: req.userPlan }, "PDF: report generated");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "PDF", message: "PDF export failed", details: msg, contractId: id }, "PDF: error");
    if (!res.headersSent) {
      res.status(500).json(structuredError("PDF", "PDF generation failed", msg));
    } else {
      res.end();
    }
  }
});

// =====================================================
// FEATURE 3: Contract Comparison (Pro + Premium + Team)
// =====================================================
router.post("/contracts/compare", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { contractIdA, contractIdB, language } = req.body as { contractIdA?: string; contractIdB?: string; language?: string };

  if (req.userPlan === "free") {
    res.status(403).json(structuredError("PLAN", "Comparison requires Pro or Legal Partner plan", `plan=${req.userPlan}`));
    return;
  }
  if (!contractIdA || !contractIdB || contractIdA === contractIdB) {
    res.status(400).json(structuredError("VALIDATION", "Two distinct contract IDs are required", `A=${contractIdA} B=${contractIdB}`));
    return;
  }

  try {
    const both = await db.select().from(contractsTable)
      .where(and(eq(contractsTable.userId, req.userId!)));
    const a = both.find((c) => c.id === contractIdA);
    const b = both.find((c) => c.id === contractIdB);
    if (!a || !b) {
      res.status(404).json(structuredError("SYSTEM", "One or both contracts not found", `A=${a ? "ok" : "missing"} B=${b ? "ok" : "missing"}`));
      return;
    }

    // Use analyses (extracted text is purged after analysis)
    const aAnalysis = (await db.select().from(analysesTable).where(eq(analysesTable.contractId, contractIdA)).limit(1))[0];
    const bAnalysis = (await db.select().from(analysesTable).where(eq(analysesTable.contractId, contractIdB)).limit(1))[0];
    if (!aAnalysis || !bAnalysis) {
      res.status(422).json(structuredError("VALIDATION", "Both contracts must be analyzed before comparison", "missing analysis"));
      return;
    }

    const langName = language && language !== "en" ? LANGUAGE_NAMES[language] ?? "" : "";
    const langRule = langName ? `\nIMPORTANT: You MUST write all text in ${langName}.` : "";

    const buildSnapshot = (label: string, c: typeof aAnalysis) =>
      `=== ${label} ===\nType: ${c.contractType ?? "Unknown"}\nParties: ${(c.parties ?? []).join(", ") || "Unknown"}\nJurisdiction: ${c.jurisdiction ?? "Unknown"}\nRisk: ${c.riskScore}/100 ${c.riskCategory}\nSummary: ${c.summary}\nClauses:\n${(c.clauses ?? []).map((cl) => `- ${cl.title}: ${cl.text}`).join("\n")}\nRisks: ${c.risks.join(" | ")}\nKey Clauses: ${c.keyClauses.join(" | ")}`;

    const systemPrompt = `You are a legal contract comparison expert. Compare two contracts and identify the meaningful differences. Respond ONLY with valid JSON of this shape:
{
  "differences": [
    { "section": "string", "changeType": "added" | "removed" | "modified", "originalText": "string (excerpt from A or empty)", "newText": "string (excerpt from B or empty)", "significance": "low" | "medium" | "high", "explanation": "string (plain-English impact)" }
  ],
  "summary": "string (2–4 sentence overall comparison summary)"
}
Identify 5–15 differences. Focus on terms that materially affect the signing party (payment, liability, termination, IP, jurisdiction, term length, auto-renewal, indemnification).${langRule}`;

    const userPrompt = `${buildSnapshot("CONTRACT A", aAnalysis)}\n\n${buildSnapshot("CONTRACT B", bAnalysis)}\n\nCompare A vs B and produce the JSON.`;

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.15,
      max_tokens: 3500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("GROQ returned empty content");

    let parsed: { differences?: unknown[]; summary?: string };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      throw new Error("GROQ comparison response was not valid JSON");
    }

    const differences = Array.isArray(parsed.differences) ? parsed.differences.slice(0, 30).map((d) => {
      const o = (d ?? {}) as Record<string, unknown>;
      const ct = String(o["changeType"] ?? "modified").toLowerCase();
      const sig = String(o["significance"] ?? "medium").toLowerCase();
      return {
        section: String(o["section"] ?? "Unknown"),
        changeType: (ct === "added" || ct === "removed" || ct === "modified") ? ct : "modified",
        originalText: String(o["originalText"] ?? ""),
        newText: String(o["newText"] ?? ""),
        significance: (sig === "high" || sig === "low" || sig === "medium") ? sig : "medium",
        explanation: String(o["explanation"] ?? ""),
      };
    }) : [];

    req.log.info({ source: "AI", feature: "COMPARE", contractA: contractIdA, contractB: contractIdB, diffCount: differences.length }, "Compare: complete");

    res.json({
      contractA: { id: a.id, filename: a.filename },
      contractB: { id: b.id, filename: b.filename },
      summary: parsed.summary ?? "",
      differences,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "AI", message: "Compare failed", details: msg }, "Compare: error");
    res.status(500).json(structuredError("AI", "Contract comparison failed", msg));
  }
});

// =====================================================
// FEATURE 8: Demo (no auth, IP-rate-limited 3/day)
// =====================================================
const SAMPLE_CONTRACT = `INDEPENDENT CONTRACTOR SERVICES AGREEMENT

This Independent Contractor Services Agreement ("Agreement") is entered into as of January 15, 2026 ("Effective Date") between Acme Innovations, Inc., a Delaware corporation ("Company"), and Jane Doe, an individual ("Contractor").

1. SERVICES. Contractor agrees to provide software development services as described in Exhibit A.

2. COMPENSATION. Company shall pay Contractor $150 per hour, invoiced monthly, payable Net 60 days. Late payments incur no interest. Company may dispute any invoice within 90 days of receipt and withhold payment without penalty.

3. TERM AND TERMINATION. This Agreement commences on the Effective Date and continues until terminated. Either party may terminate immediately for any reason or no reason, with no notice required. Upon termination, Contractor forfeits all unpaid invoices.

4. INTELLECTUAL PROPERTY. All work product, including any pre-existing materials Contractor incorporates, becomes the exclusive property of Company. Contractor irrevocably assigns all rights, title, and interest in any inventions made during the term, regardless of whether they relate to Company's business.

5. NON-COMPETE. For 24 months after termination, Contractor shall not provide similar services to any company in the technology industry worldwide.

6. INDEMNIFICATION. Contractor shall indemnify, defend and hold harmless Company from any and all claims arising out of Contractor's services, including unlimited consequential damages, regardless of cause.

7. CONFIDENTIALITY. Contractor agrees to maintain confidentiality of Company information in perpetuity.

8. GOVERNING LAW. This Agreement is governed by Delaware law. Any disputes must be resolved in Delaware state court. Contractor waives the right to a jury trial.

9. AUTOMATIC RENEWAL. Any related Statement of Work auto-renews for successive 12-month terms unless cancelled 180 days prior to renewal in writing.

10. ENTIRE AGREEMENT. This is the entire agreement between the parties.

Signed: Acme Innovations, Inc.    Signed: Jane Doe`;

const demoIpHits = new Map<string, { count: number; resetAt: number }>();
const DEMO_LIMIT = 3;
const DEMO_WINDOW_MS = 24 * 60 * 60 * 1000;

router.post("/demo/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress ?? "unknown";

    const now = Date.now();
    const entry = demoIpHits.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= DEMO_LIMIT) {
        res.status(429).json(structuredError("RATE_LIMIT", `Demo limit reached (${DEMO_LIMIT}/day). Sign up for free to analyze your own contracts.`, `ip=${ip} count=${entry.count}`));
        return;
      }
      entry.count += 1;
    } else {
      demoIpHits.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
    }

    // Cleanup old entries occasionally
    if (demoIpHits.size > 1000) {
      for (const [k, v] of demoIpHits) {
        if (v.resetAt < now) demoIpHits.delete(k);
      }
    }

    const systemPrompt = `You are ContractAI's demo analyzer. Analyze the provided contract and respond ONLY with valid JSON of this shape:
{
  "summary": "string (3-5 sentences)",
  "risks": ["string (Section X — Name: explanation)"],
  "key_clauses": ["string (Section X — Name: explanation)"],
  "riskScore": 0-100,
  "riskCategory": "Low Risk" | "Moderate" | "High" | "Extreme",
  "contractType": "string",
  "parties": ["string"],
  "jurisdiction": "string",
  "importantDates": [{ "date": "YYYY-MM-DD or descriptive", "description": "string" }],
  "clauses": [{ "id": "c1", "title": "string", "text": "string (excerpt, max 300 chars)", "explanation": "string", "riskLevel": "safe" | "caution" | "risky", "riskReason": "string" }],
  "renegotiation": [{ "clauseName": "string", "problem": "string", "suggestion": "string", "severity": "low" | "medium" | "high" }]
}
Provide thorough, professional analysis. 6–10 risks, 5–8 key clauses, 6–10 clauses breakdown, 4–6 renegotiation items. Respond with valid JSON only.`;

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this sample contract:\n\n${SAMPLE_CONTRACT}` },
      ],
      temperature: 0.1,
      max_tokens: 4500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("GROQ returned empty content");

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const score = Number(parsed["riskScore"]);
    const finalScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 35;

    req.log.info({ source: "AI", feature: "DEMO", ip }, "Demo: analysis served");

    res.json({
      isDemo: true,
      filename: "Sample Independent Contractor Agreement",
      summary: String(parsed["summary"] ?? ""),
      risks: Array.isArray(parsed["risks"]) ? (parsed["risks"] as unknown[]).map(String) : [],
      keyClauses: Array.isArray(parsed["key_clauses"]) ? (parsed["key_clauses"] as unknown[]).map(String) : [],
      riskScore: finalScore,
      riskCategory: typeof parsed["riskCategory"] === "string" ? parsed["riskCategory"] : (finalScore >= 80 ? "Low Risk" : finalScore >= 50 ? "Moderate" : finalScore >= 20 ? "High" : "Extreme"),
      contractType: parsed["contractType"] ?? "Independent Contractor Agreement",
      parties: Array.isArray(parsed["parties"]) ? parsed["parties"] : ["Acme Innovations, Inc.", "Jane Doe"],
      jurisdiction: parsed["jurisdiction"] ?? "Delaware, USA",
      importantDates: Array.isArray(parsed["importantDates"]) ? parsed["importantDates"] : [],
      clauses: Array.isArray(parsed["clauses"]) ? parsed["clauses"] : [],
      renegotiation: Array.isArray(parsed["renegotiation"]) ? parsed["renegotiation"] : [],
      remainingDemos: Math.max(0, DEMO_LIMIT - (demoIpHits.get(ip)?.count ?? 0)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "AI", message: "Demo analysis failed", details: msg }, "Demo: error");
    res.status(500).json(structuredError("AI", "Demo analysis failed — please try again", msg));
  }
});

export default router;
