import { Router } from "express";
import type { Response, Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const DODO_API_KEY = process.env["DODO_API_KEY"];
const DODO_WEBHOOK_SECRET = process.env["DODO_WEBHOOK_SECRET"];
const DODO_PRO_PLAN_ID = process.env["DODO_PRO_PLAN_ID"];
const DODO_PREMIUM_PLAN_ID = process.env["DODO_PREMIUM_PLAN_ID"];

async function getCountryFromIp(ip: string): Promise<string> {
  try {
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return "US";
    }
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    if (!response.ok) return "US";
    const data = await response.json() as { countryCode?: string };
    return data.countryCode ?? "US";
  } catch {
    return "US";
  }
}

router.post("/checkout", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !["pro", "premium"].includes(plan)) {
    res.status(400).json({ error: "BadRequest", message: "Invalid plan. Must be 'pro' or 'premium'" });
    return;
  }

  if (!DODO_API_KEY) {
    res.status(500).json({ error: "ConfigError", message: "Payment service not configured" });
    return;
  }

  const productId = plan === "pro" ? DODO_PRO_PLAN_ID : DODO_PREMIUM_PLAN_ID;
  if (!productId) {
    res.status(500).json({ error: "ConfigError", message: "Plan product ID not configured" });
    return;
  }

  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "127.0.0.1";
    const country = await getCountryFromIp(clientIp);

    const domains = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "localhost";
    const baseUrl = `https://${domains}`;

    const payload = {
      product_id: productId,
      quantity: 1,
      customer: {
        email: req.userEmail,
      },
      billing: {
        country,
        state: "",
        city: "",
        street: "",
        zip: "",
      },
      success_url: `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: `${baseUrl}/pricing?cancelled=true`,
      metadata: {
        userId: req.userId,
        plan,
      },
    };

    req.log.info({ plan, productId, country }, "Creating Dodo checkout");

    const response = await fetch("https://api.dodopayments.com/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ status: response.status, errorText, plan }, "Dodo checkout failed");
      res.status(502).json({ error: "PaymentError", message: "Payment service error. Please try again." });
      return;
    }

    const data = await response.json() as { payment_link?: string; url?: string; checkout_url?: string };
    const checkoutUrl = data.payment_link ?? data.url ?? data.checkout_url;

    if (!checkoutUrl) {
      req.log.error({ data }, "No checkout URL in Dodo response");
      res.status(502).json({ error: "PaymentError", message: "Could not create checkout session" });
      return;
    }

    req.log.info({ plan, checkoutUrl }, "Checkout session created");
    res.json({ success: true, checkout_url: checkoutUrl });
  } catch (err) {
    req.log.error({ err }, "Checkout error");
    res.status(500).json({ error: "InternalError", message: "Failed to create checkout" });
  }
});

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers["webhook-signature"] ?? req.headers["x-webhook-signature"];

    if (DODO_WEBHOOK_SECRET && !signature) {
      req.log.warn("Webhook received without signature");
    }

    const event = req.body as {
      type?: string;
      data?: {
        metadata?: { userId?: string; plan?: string };
        status?: string;
      };
    };

    req.log.info({ eventType: event.type }, "Dodo webhook received");

    if (event.type === "subscription.activated" || event.type === "payment.succeeded") {
      const userId = event.data?.metadata?.userId;
      const plan = event.data?.metadata?.plan as "pro" | "premium" | undefined;

      if (userId && plan && ["pro", "premium"].includes(plan)) {
        const planLimits: Record<string, number> = { pro: 50, premium: 999 };

        await db.update(usersTable)
          .set({
            plan,
            contractsUsed: 0,
          })
          .where(eq(usersTable.id, userId));

        req.log.info({ userId, plan }, "User plan upgraded via webhook");
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Webhook error");
    res.status(500).json({ error: "WebhookError", message: "Webhook processing failed" });
  }
});

export default router;
