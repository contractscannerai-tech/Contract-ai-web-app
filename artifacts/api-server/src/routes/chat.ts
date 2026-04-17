import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable, chatMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { chatLimiter } from "../lib/rate-limit.js";

const router = Router();
const groq = new Groq({ apiKey: process.env["GROQ_API_KEY"] });

router.post("/:contractId", requireAuth, chatLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { contractId } = req.params as { contractId: string };

  if (req.userPlan !== "premium") {
    res.status(403).json({ error: "PremiumRequired", message: "AI chat is a Premium feature. Please upgrade your plan." });
    return;
  }

  const { message, language } = req.body as { message?: string; language?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "BadRequest", message: "Message is required" });
    return;
  }

  try {
    const contracts = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.id, contractId), eq(contractsTable.userId, req.userId!)))
      .limit(1);

    if (contracts.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Contract not found" });
      return;
    }

    const contract = contracts[0];
    const analyses = await db.select().from(analysesTable).where(eq(analysesTable.contractId, contractId)).limit(1);
    const analysis = analyses[0];

    const recentMessages = await db
      .select()
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.contractId, contractId), eq(chatMessagesTable.userId, req.userId!)))
      .orderBy(chatMessagesTable.createdAt);

    const lastMessages = recentMessages.slice(-10);

    const userMsgId = uuidv4();
    await db.insert(chatMessagesTable).values({
      id: userMsgId,
      contractId,
      userId: req.userId!,
      role: "user",
      content: message,
    });

    const LANG_NAMES: Record<string, string> = { en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", ar: "Arabic", zh: "Chinese", hi: "Hindi", ja: "Japanese" };
    const langName = language && language !== "en" ? LANG_NAMES[language] ?? "" : "";
    const langRule = langName ? `\n\nIMPORTANT: You MUST respond entirely in ${langName}.` : "";

    const systemPrompt = `You are ContractAI's expert legal assistant. You help users understand their contracts in plain English.${langRule}

Contract: "${contract.filename}"
${analysis ? `
Summary: ${analysis.summary}
Key Risks: ${analysis.risks.join("; ")}
Key Clauses: ${analysis.keyClauses.join("; ")}
Risk Level: ${analysis.riskLevel}` : "This contract has not been analyzed yet."}

${contract.extractedText ? `Contract Text (excerpt): ${contract.extractedText.slice(0, 3000)}` : ""}

Answer questions clearly and concisely. Explain legal terms in plain English. If asked about something not in the contract, say so. Do not provide formal legal advice — remind users to consult a licensed attorney for important decisions.`;

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...lastMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content ?? "I could not generate a response. Please try again.";

    const assistantMsgId = uuidv4();
    await db.insert(chatMessagesTable).values({
      id: assistantMsgId,
      contractId,
      userId: req.userId!,
      role: "assistant",
      content: reply,
    });

    req.log.info({ contractId, userId: req.userId }, "Chat message processed");
    res.json({ reply, messageId: assistantMsgId });
  } catch (err) {
    req.log.error({
      error: true, source: "AI",
      message: "Chat processing failed",
      details: err instanceof Error ? err.message : String(err),
      contractId,
    }, "Chat: unhandled exception");
    res.status(500).json({ error: "InternalError", message: "Chat failed. Please try again." });
  }
});

router.get("/:contractId", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { contractId } = req.params as { contractId: string };

  if (req.userPlan !== "premium") {
    res.status(403).json({ error: "PremiumRequired", message: "AI chat is a Premium feature." });
    return;
  }

  try {
    const contracts = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.id, contractId), eq(contractsTable.userId, req.userId!)))
      .limit(1);

    if (contracts.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Contract not found" });
      return;
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.contractId, contractId), eq(chatMessagesTable.userId, req.userId!)))
      .orderBy(chatMessagesTable.createdAt);

    res.json(messages);
  } catch (err) {
    req.log.error({
      error: true, source: "SYSTEM",
      message: "Failed to retrieve chat history",
      details: err instanceof Error ? err.message : String(err),
      contractId,
    }, "Chat history: unhandled exception");
    res.status(500).json({ error: "InternalError", message: "Failed to get chat history" });
  }
});

export default router;
