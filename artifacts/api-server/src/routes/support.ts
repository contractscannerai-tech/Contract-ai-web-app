import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

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
        headers: {
          Authorization: `Bearer ${sgApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: supportEmail }] }],
          from: { email: "noreply@contractai.app", name: "ContractAI Support" },
          subject: `[ContractAI Support] ${type ?? "General"} - ${req.userId}`,
          content: [{
            type: "text/plain",
            value: `Support Request\n\nUser ID: ${req.userId}\nType: ${type ?? "general"}\n\nMessage:\n${message}\n\nTimestamp: ${new Date().toISOString()}`,
          }],
        }),
      });

      if (!sgResponse.ok) {
        req.log.error({ source: "SUPPORT", status: sgResponse.status }, "Support: SendGrid send failed");
      }
    }

    req.log.info({
      source: "SUPPORT",
      userId: req.userId,
      type: type ?? "general",
      messageLength: message.length,
    }, "Support: escalation submitted");

    res.json({ message: "Support request submitted successfully" });
  } catch (err) {
    req.log.error({
      error: true, source: "SUPPORT",
      details: err instanceof Error ? err.message : String(err),
    }, "Support: escalation failed");
    res.status(500).json({ error: "InternalError", message: "Failed to submit support request" });
  }
});

export default router;
