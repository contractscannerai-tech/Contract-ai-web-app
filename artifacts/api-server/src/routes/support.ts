import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Groq from "groq-sdk";
import { db, chatMessagesTable, usersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const SUPPORT_THREAD_PREFIX = "support:";
const HISTORY_LIMIT = 50;

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function getGroq() {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: key });
}

const BASE_SYSTEM_PROMPT = `You are ContractAI's personal AI assistant — like a knowledgeable friend who happens to know contracts inside out.

About ContractAI:
- Plans: Starter/Free (3 contracts/month, basic risk names), Pro ($29/mo, 50 contracts, full analysis + negotiation tips), Legal Partner/Premium ($99/mo, 999 contracts + AI chat + comparison + PDF export + AI tools), Team ($399/mo, up to 5 users, full premium for each).
- Features: PDF/photo upload, OCR, AI risk analysis, risk score 0-100, clause-by-clause breakdown, "Ask Your Contract" Q&A, PDF export (Pro+), comparison (Pro+), renegotiation tips (Pro+), AI tools — drafting/resume/career/applications (Premium+), referral rewards.

Style:
- Conversational and warm, like ChatGPT. Use the user's name if you know it.
- Reply in 2-6 sentences usually. Longer when explaining something complex.
- Remember context across the conversation — refer back to what the user has told you before.
- If asked about billing/refund/account-deletion, suggest they tap the "Contact human support" link in the menu.
- Do NOT invent features that don't exist. If unsure, say so.`;

function buildSystemPrompt(user: { displayName: string | null; profession: string | null; chatPersonalization: string | null; plan: string }): string {
  const personal: string[] = [];
  if (user.displayName) personal.push(`The user's name is ${user.displayName}.`);
  if (user.profession) personal.push(`They work as: ${user.profession}.`);
  if (user.chatPersonalization) personal.push(`Additional context the user wants you to remember: ${user.chatPersonalization}`);
  personal.push(`Their current plan is: ${user.plan}.`);
  return `${BASE_SYSTEM_PROMPT}\n\nUser profile:\n${personal.join("\n")}`;
}

router.post("/escalate", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { type, message } = req.body as { type?: string; message?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: "BadRequest", message: "Message is required" });
    return;
  }

  try {
    const sgApiKey = process.env["SENDGRID_API_KEY"];
    const supportEmail = process.env["SUPPORT_EMAIL"];

    if (sgApiKey && supportEmail) {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sgApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: supportEmail }] }],
          from: { email: "noreply@contractai.app", name: "ContractAI Support" },
          subject: `[ContractAI Support] ${type ?? "General"} - ${req.userId}`,
          content: [{
            type: "text/plain",
            value: `Support Request\n\nUser ID: ${req.userId}\nUser email: ${req.userEmail}\nType: ${type ?? "general"}\n\nMessage:\n${message}\n\nTimestamp: ${new Date().toISOString()}`,
          }],
        }),
      });
      if (!sgResponse.ok) {
        req.log.error({ source: "SUPPORT", status: sgResponse.status }, "Support: SendGrid send failed");
      }
    }

    req.log.info({ source: "SUPPORT", userId: req.userId, type: type ?? "general" }, "Support: escalation submitted");
    res.json({ message: "Support request submitted successfully" });
  } catch (err) {
    req.log.error({ error: true, source: "SUPPORT", details: err instanceof Error ? err.message : String(err) }, "Support: escalation failed");
    res.status(500).json({ error: "InternalError", message: "Failed to submit support request" });
  }
});

router.get("/chat/history", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const threadId = `${SUPPORT_THREAD_PREFIX}${req.userId!}`;
    const rows = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.contractId, threadId))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(50);
    res.json({
      messages: rows.map((m) => ({
        id: m.id, role: m.role, content: m.content, createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json(structuredError("SUPPORT", "Could not load chat", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/chat", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json(structuredError("VALIDATION", "Message is required", "empty body.message"));
    return;
  }

  if (req.userPlan !== "premium" && req.userPlan !== "team") {
    res.status(402).json({
      error: "UpgradeRequired",
      code: "PLAN_LOCKED",
      message: "The personal AI Assistant is available on Legal Partner and Team plans.",
      requiredPlan: "premium",
      source: "PLAN",
    });
    return;
  }

  try {
    const threadId = `${SUPPORT_THREAD_PREFIX}${req.userId!}`;

    const userRows = await db.select({
      displayName: usersTable.displayName,
      profession: usersTable.profession,
      chatPersonalization: usersTable.chatPersonalization,
      plan: usersTable.plan,
    }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const userInfo = userRows[0] ?? { displayName: null, profession: null, chatPersonalization: null, plan: req.userPlan ?? "free" };

    const history = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.contractId, threadId))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(HISTORY_LIMIT);

    await db.insert(chatMessagesTable).values({
      id: uuidv4(), contractId: threadId, userId: req.userId!,
      role: "user", content: message.trim(),
    });

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: buildSystemPrompt(userInfo) },
        ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: message.trim() },
      ],
      temperature: 0.5,
      max_tokens: 700,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "I couldn't generate a response — please try rephrasing.";

    await db.insert(chatMessagesTable).values({
      id: uuidv4(), contractId: threadId, userId: req.userId!,
      role: "assistant", content: reply,
    });

    req.log.info({ source: "SUPPORT", feature: "AI_CHAT", userId: req.userId }, "Support chat: reply generated");
    res.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "SUPPORT", details: msg }, "Support chat: failed");
    res.status(500).json(structuredError("SUPPORT", "Could not get a response — please try again", msg));
  }
});

export default router;
