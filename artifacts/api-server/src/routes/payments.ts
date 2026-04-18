import { Router } from "express";
import type { Response, Request } from "express";
import crypto from "crypto";
import { db, usersTable, referralsTable } from "@workspace/db";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const PROD_BASE_URL = "https://contract-ai--Contractaiscan.replit.app";

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
      if (!r.ok) throw new Error(`ipapi.co ${r.status}`);
      const text = (await r.text()).trim();
      if (!/^[A-Z]{2}$/.test(text)) throw new Error(`ipapi.co bad value: ${text}`);
      return text;
    },
    async () => {
      const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(`ip-api.com ${r.status}`);
      const d = await r.json() as { countryCode?: string };
      if (!d.countryCode || !/^[A-Z]{2}$/.test(d.countryCode)) throw new Error("ip-api.com: missing countryCode");
      return d.countryCode;
    },
  ];

  for (const svc of services) {
    try { return await svc(); } catch { continue; }
  }
  return "US";
}

function verifyDodoSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  try {
    const msgId = String(headers["webhook-id"] ?? "");
    const msgTimestamp = String(headers["webhook-timestamp"] ?? "");
    const sigHeader = String(headers["webhook-signature"] ?? "");

    if (!msgId || !msgTimestamp || !sigHeader) return false;

    const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const secretBytes = Buffer.from(cleanSecret, "base64");

    const message = `${msgId}.${msgTimestamp}.${rawBody.toString("utf8")}`;
    const expectedSig = crypto
      .createHmac("sha256", secretBytes)
      .update(message)
      .digest("base64");

    const providedSigs = sigHeader.split(" ").map((s) => s.replace(/^v\d+,/, ""));
    return providedSigs.some((sig) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(sig, "base64"),
          Buffer.from(expectedSig, "base64")
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

router.post("/checkout", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !["pro", "premium", "team"].includes(plan)) {
    res.status(400).json(structuredError("PAYMENT", "Invalid plan", `plan=${plan ?? "undefined"} must be 'pro', 'premium' or 'team'`));
    return;
  }

  const DODO_API_KEY = process.env["DODO_API_KEY"];
  const PLAN_ENV: Record<string, string> = {
    pro: "DODO_PRO_PLAN_ID",
    premium: "DODO_PREMIUM_PLAN_ID",
    team: "DODO_TEAM_PLAN_ID",
  };

  if (!DODO_API_KEY) {
    req.log.error({ error: true, source: "PAYMENT", message: "DODO_API_KEY missing" }, "Checkout: missing API key");
    res.status(500).json(structuredError("PAYMENT", "Payment service not configured", "DODO_API_KEY missing"));
    return;
  }

  const envName = PLAN_ENV[plan]!;
  const productId = process.env[envName];
  if (!productId) {
    req.log.error({ error: true, source: "PAYMENT", message: `${envName} missing` }, "Checkout: missing product ID");
    res.status(500).json(structuredError("PAYMENT", `${plan} plan product ID not configured`, `${envName} missing`));
    return;
  }

  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress
      ?? "127.0.0.1";
    const country = await getCountryFromIp(clientIp);

    const payload = {
      product_id: productId,
      quantity: 1,
      payment_link: true,
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
      return_url: `${PROD_BASE_URL}/dashboard?upgraded=true`,
      success_url: `${PROD_BASE_URL}/dashboard?upgraded=true`,
      cancel_url: `${PROD_BASE_URL}/pricing?cancelled=true`,
      metadata: {
        userId: req.userId,
        plan,
      },
    };

    req.log.info({ source: "PAYMENT", plan, productId, country, userId: req.userId }, "Checkout: creating Dodo subscription");

    const response = await fetch("https://live.dodopayments.com/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text().catch(() => "");

    if (!response.ok) {
      req.log.error({
        error: true, source: "PAYMENT",
        message: "Dodo API non-2xx response",
        details: `HTTP ${response.status}: ${rawBody}`,
        plan, productId, country, userId: req.userId,
      }, "Checkout: Dodo error");
      res.status(502).json(structuredError("PAYMENT", "Payment gateway error", `Dodo HTTP ${response.status}: ${rawBody}`));
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      req.log.error({ error: true, source: "PAYMENT", message: "Dodo returned non-JSON", details: rawBody, plan, userId: req.userId }, "Checkout: bad response format");
      res.status(502).json(structuredError("PAYMENT", "Payment gateway returned invalid response", rawBody.slice(0, 500)));
      return;
    }

    req.log.info({ source: "PAYMENT", plan, userId: req.userId, dodoResponse: data }, "Checkout: Dodo full response");

    const subscriptionId = data["subscription_id"] as string | undefined;
    const paymentId = data["payment_id"] as string | undefined;

    const checkoutUrl =
      (typeof data["payment_link"] === "string" && data["payment_link"]) ||
      (typeof data["url"] === "string" && data["url"]) ||
      (typeof data["checkout_url"] === "string" && data["checkout_url"]) ||
      (paymentId ? `https://pay.dodopayments.com/payment/${paymentId}` : null) ||
      (subscriptionId ? `https://pay.dodopayments.com/subscribe/${subscriptionId}` : null);

    if (!checkoutUrl) {
      req.log.error({
        error: true, source: "PAYMENT",
        message: "Cannot resolve checkout URL from Dodo response",
        details: `Response keys: ${Object.keys(data).join(", ")} | Values: ${JSON.stringify(data).slice(0, 500)}`,
        plan, userId: req.userId,
      }, "Checkout: missing checkout URL");
      res.status(502).json(structuredError(
        "PAYMENT",
        "Payment gateway did not return a checkout URL",
        `Dodo response keys: ${Object.keys(data).join(", ")}`
      ));
      return;
    }

    req.log.info({ source: "PAYMENT", plan, userId: req.userId, checkoutUrl }, "Checkout: session created");
    res.json({ success: true, checkout_url: checkoutUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "PAYMENT", message: "Checkout exception", details: msg, plan, userId: req.userId }, "Checkout: unhandled error");
    res.status(500).json(structuredError("PAYMENT", "Failed to create checkout", msg));
  }
});

router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
  const DODO_WEBHOOK_SECRET = process.env["DODO_WEBHOOK_SECRET"];

  try {
    const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    if (DODO_WEBHOOK_SECRET) {
      const isValid = verifyDodoSignature(rawBody, req.headers as Record<string, string | undefined>, DODO_WEBHOOK_SECRET);
      if (!isValid) {
        req.log.warn({
          error: true, source: "PAYMENT",
          message: "Webhook signature verification failed",
          details: "HMAC-SHA256 mismatch or missing webhook-id/webhook-timestamp headers",
        }, "Webhook: invalid signature");
        res.status(401).json(structuredError("PAYMENT", "Webhook signature invalid", "HMAC verification failed"));
        return;
      }
      req.log.info({ source: "PAYMENT" }, "Webhook: signature verified");
    } else {
      req.log.warn({ source: "PAYMENT", message: "DODO_WEBHOOK_SECRET not set — skipping verification" }, "Webhook: no secret configured");
    }

    let event: {
      type?: string;
      data?: { metadata?: { userId?: string; plan?: string }; status?: string };
    };

    try {
      event = JSON.parse(rawBody.toString("utf8")) as typeof event;
    } catch {
      res.status(400).json(structuredError("PAYMENT", "Invalid JSON body", "Could not parse webhook payload"));
      return;
    }

    req.log.info({ source: "PAYMENT", eventType: event.type }, "Webhook: event received");

    const UPGRADE_EVENTS = new Set([
      "subscription.active",
      "subscription.activated",
      "subscription.renewed",
      "payment.succeeded",
    ]);

    const DOWNGRADE_EVENTS = new Set([
      "subscription.cancelled",
      "subscription.expired",
      "subscription.on_hold",
      "subscription.failed",
    ]);

    if (UPGRADE_EVENTS.has(event.type ?? "")) {
      const userId = event.data?.metadata?.userId;
      const plan = event.data?.metadata?.plan as "pro" | "premium" | "team" | undefined;

      if (userId && plan && ["pro", "premium", "team"].includes(plan)) {
        await db.update(usersTable)
          .set({ plan, contractsUsed: 0 })
          .where(eq(usersTable.id, userId));

        const upgradedUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (upgradedUser[0]?.referredBy) {
          const bonusForReferrer = plan === "premium" ? 10 : 5;
          const referrer = await db.select().from(usersTable).where(eq(usersTable.id, upgradedUser[0].referredBy)).limit(1);
          if (referrer[0]) {
            await db.update(usersTable)
              .set({ bonusScans: (referrer[0].bonusScans ?? 0) + bonusForReferrer })
              .where(eq(usersTable.id, referrer[0].id));

            const newStatus = plan === "premium" ? "subscribed_premium" : "subscribed_pro";
            await db.insert(referralsTable).values({
              id: uuidv4(),
              referrerId: referrer[0].id,
              referredId: userId,
              status: newStatus as "subscribed_pro" | "subscribed_premium",
              scansAwarded: bonusForReferrer,
            }).onConflictDoNothing();

            req.log.info({ source: "REFERRAL", referrerId: referrer[0].id, referredId: userId, bonus: bonusForReferrer, plan }, "Webhook: referral bonus awarded for subscription upgrade");
          }
        }

        req.log.info({ source: "PAYMENT", userId, plan, eventType: event.type }, "Webhook: plan upgraded — features unlocked");
      } else {
        req.log.warn({
          source: "PAYMENT",
          message: "Upgrade event missing userId or valid plan in metadata",
          details: `userId=${userId ?? "missing"}, plan=${plan ?? "missing"}, eventType=${event.type}`,
        }, "Webhook: incomplete upgrade metadata");
      }
    } else if (DOWNGRADE_EVENTS.has(event.type ?? "")) {
      const userId = event.data?.metadata?.userId;

      if (userId) {
        const current = await db.select({ plan: usersTable.plan })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);

        if (current[0] && current[0].plan !== "free") {
          await db.update(usersTable)
            .set({ plan: "free" })
            .where(eq(usersTable.id, userId));

          req.log.info({ source: "PAYMENT", userId, prevPlan: current[0].plan, eventType: event.type }, "Webhook: subscription ended — downgraded to free");
        }
      } else {
        req.log.warn({
          source: "PAYMENT",
          message: "Downgrade event missing userId",
          details: `eventType=${event.type}`,
        }, "Webhook: incomplete downgrade metadata");
      }
    } else {
      req.log.info({ source: "PAYMENT", eventType: event.type }, "Webhook: unhandled event type (acknowledged)");
    }

    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({
      error: true, source: "PAYMENT",
      message: "Unexpected error processing webhook",
      details: msg,
      stack: err instanceof Error ? err.stack : undefined,
    }, "Webhook: unhandled exception");
    res.status(500).json(structuredError("PAYMENT", "Webhook processing failed", msg));
  }
});

export default router;
