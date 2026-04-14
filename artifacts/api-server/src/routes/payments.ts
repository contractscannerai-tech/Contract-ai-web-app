import { Router } from "express";
import type { Response, Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

async function getCountryFromIp(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1"
    || ip.startsWith("10.") || ip.startsWith("172.16.") || ip.startsWith("192.168.")) {
    return "US";
  }

  const services = [
    async () => {
      const r = await fetch(`https://ipapi.co/${ip}/country/`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(`ipapi.co status ${r.status}`);
      const text = (await r.text()).trim();
      if (text.length !== 2 || !/^[A-Z]{2}$/.test(text)) throw new Error(`ipapi.co bad response: ${text}`);
      return text;
    },
    async () => {
      const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(`ip-api.com status ${r.status}`);
      const data = await r.json() as { countryCode?: string };
      if (!data.countryCode) throw new Error("ip-api.com: no countryCode");
      return data.countryCode;
    },
  ];

  for (const service of services) {
    try {
      const country = await service();
      return country;
    } catch {
      continue;
    }
  }

  return "US";
}

router.post("/checkout", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !["pro", "premium"].includes(plan)) {
    res.status(400).json(structuredError("PAYMENT", "Invalid plan specified", `Received plan=${plan ?? "undefined"}, must be 'pro' or 'premium'`));
    return;
  }

  const DODO_API_KEY = process.env["DODO_API_KEY"];
  const DODO_PRO_PLAN_ID = process.env["DODO_PRO_PLAN_ID"];
  const DODO_PREMIUM_PLAN_ID = process.env["DODO_PREMIUM_PLAN_ID"];

  if (!DODO_API_KEY) {
    req.log.error({
      error: true, source: "PAYMENT",
      message: "Dodo Payments API key not configured",
      details: "DODO_API_KEY environment variable is missing",
    }, "Checkout: DODO_API_KEY missing");
    res.status(500).json(structuredError("PAYMENT", "Payment service is not configured", "DODO_API_KEY is missing from environment"));
    return;
  }

  const productId = plan === "pro" ? DODO_PRO_PLAN_ID : DODO_PREMIUM_PLAN_ID;
  if (!productId) {
    req.log.error({
      error: true, source: "PAYMENT",
      message: "Dodo product ID not configured for plan",
      details: `Plan=${plan}, missing env var: ${plan === "pro" ? "DODO_PRO_PLAN_ID" : "DODO_PREMIUM_PLAN_ID"}`,
    }, "Checkout: product ID missing");
    res.status(500).json(structuredError("PAYMENT", `Product ID for ${plan} plan is not configured`, `Missing ${plan === "pro" ? "DODO_PRO_PLAN_ID" : "DODO_PREMIUM_PLAN_ID"}`));
    return;
  }

  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "127.0.0.1";

    const country = await getCountryFromIp(clientIp);

    const BASE_URL = "https://contract-ai--Contractaiscan.replit.app";

    const payload = {
      product_id: productId,
      quantity: 1,
      customer: {
        name: "",
        email: req.userEmail ?? "",
      },
      billing: {
        country,
        state: "",
        city: "",
        street: "",
        zipcode: "",
      },
      success_url: `${BASE_URL}/dashboard?upgraded=true`,
      cancel_url: `${BASE_URL}/pricing?cancelled=true`,
      metadata: {
        userId: req.userId,
        plan,
      },
    };

    req.log.info({ source: "PAYMENT", plan, productId, country, userId: req.userId, clientIp }, "Checkout: creating Dodo subscription");

    const response = await fetch("https://api.dodopayments.com/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "(unreadable)");
      req.log.error({
        error: true, source: "PAYMENT",
        message: "Dodo Payments API returned non-2xx response",
        details: `HTTP ${response.status}: ${errorText}`,
        plan, productId, userId: req.userId,
      }, "Checkout: Dodo API error");
      res.status(502).json(structuredError("PAYMENT", "Payment gateway returned an error", `Dodo HTTP ${response.status}: ${errorText}`));
      return;
    }

    const data = await response.json() as {
      payment_link?: string;
      url?: string;
      checkout_url?: string;
      client_secret?: string;
    };

    const checkoutUrl = data.payment_link ?? data.url ?? data.checkout_url;

    if (!checkoutUrl) {
      req.log.error({
        error: true, source: "PAYMENT",
        message: "Dodo response did not contain a checkout URL",
        details: `Response keys: ${Object.keys(data).join(", ")}`,
        plan, userId: req.userId,
      }, "Checkout: no checkout URL in Dodo response");
      res.status(502).json(structuredError("PAYMENT", "No checkout URL returned from payment gateway", `Response keys: ${Object.keys(data).join(", ")}`));
      return;
    }

    req.log.info({ source: "PAYMENT", plan, userId: req.userId }, "Checkout: session created successfully");
    res.json({ success: true, checkout_url: checkoutUrl });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true, source: "PAYMENT",
      message: "Unexpected error during checkout creation",
      details: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
      plan, userId: req.userId,
    }, "Checkout: unhandled exception");
    res.status(500).json(structuredError("PAYMENT", "Failed to create checkout session", errMsg));
  }
});

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  const DODO_WEBHOOK_SECRET = process.env["DODO_WEBHOOK_SECRET"];

  try {
    const signature = req.headers["webhook-signature"] ?? req.headers["x-webhook-signature"];

    if (DODO_WEBHOOK_SECRET && !signature) {
      req.log.warn({
        error: false, source: "PAYMENT",
        message: "Webhook received without a signature header",
        details: "DODO_WEBHOOK_SECRET is set but no signature was provided — possible spoofed request",
      }, "Webhook: missing signature");
    }

    const event = req.body as {
      type?: string;
      data?: {
        metadata?: { userId?: string; plan?: string };
        status?: string;
      };
    };

    req.log.info({ source: "PAYMENT", eventType: event.type }, "Webhook: event received");

    if (event.type === "subscription.activated" || event.type === "payment.succeeded") {
      const userId = event.data?.metadata?.userId;
      const plan = event.data?.metadata?.plan as "pro" | "premium" | undefined;

      if (userId && plan && ["pro", "premium"].includes(plan)) {
        await db.update(usersTable)
          .set({ plan, contractsUsed: 0 })
          .where(eq(usersTable.id, userId));

        req.log.info({ source: "PAYMENT", userId, plan, eventType: event.type }, "Webhook: user plan upgraded successfully");
      } else {
        req.log.warn({
          source: "PAYMENT",
          message: "Webhook payment event missing userId or valid plan in metadata",
          details: `userId=${userId ?? "missing"}, plan=${plan ?? "missing"}`,
          eventType: event.type,
        }, "Webhook: incomplete metadata");
      }
    }

    res.json({ success: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true, source: "PAYMENT",
      message: "Unexpected error processing Dodo webhook",
      details: errMsg,
      stack: err instanceof Error ? err.stack : undefined,
    }, "Webhook: unhandled exception");
    res.status(500).json(structuredError("PAYMENT", "Webhook processing failed", errMsg));
  }
});

export default router;
