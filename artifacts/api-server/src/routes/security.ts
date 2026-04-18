import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// Allowed hosts for the official ContractAI client.
// In dev (no APP_OFFICIAL_HOSTS set) we accept any host.
// In prod, set APP_OFFICIAL_HOSTS to a comma-separated list, e.g. "contractai.example.com,contractai.replit.app".
function getAllowedHosts(): string[] | null {
  const raw = process.env["APP_OFFICIAL_HOSTS"];
  if (!raw) return null;
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function hostFrom(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    // value can be a full URL or just a host
    if (value.includes("://")) return new URL(value).host.toLowerCase();
    return value.toLowerCase().replace(/^https?:\/\//, "").split("/")[0]!;
  } catch {
    return null;
  }
}

router.get("/integrity", (req: Request, res: Response): void => {
  const allowed = getAllowedHosts();
  const origin = hostFrom(req.headers.origin as string | undefined);
  const referer = hostFrom(req.headers.referer as string | undefined);
  const callerHost = origin ?? referer;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? "";

  // Always block clearly automated/headless tooling that's not a real browser.
  // We allow real native shells (Capacitor/Cordova/Expo) which set their own UA strings.
  const looksLikeBrowserOrApp = /Mozilla\/|Capacitor|Cordova|Expo|ContractAI/i.test(userAgent);

  if (!looksLikeBrowserOrApp) {
    res.json({ official: false, reason: "client" });
    return;
  }

  if (!allowed) {
    // Dev / unconfigured — allow.
    res.json({ official: true, mode: "permissive" });
    return;
  }

  if (!callerHost) {
    res.json({ official: false, reason: "origin" });
    return;
  }

  const isAllowed = allowed.some((h) => callerHost === h || callerHost.endsWith(`.${h}`));
  res.json({ official: isAllowed, reason: isAllowed ? null : "host" });
});

export default router;
