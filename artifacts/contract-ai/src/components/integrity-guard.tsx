import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

// IntegrityGuard verifies the running app is the official ContractAI build
// served from an approved host. It calls a backend endpoint that checks the
// request's Origin/Referer + User-Agent against an allowlist (configured via
// the APP_OFFICIAL_HOSTS env var on the server).
//
// If the check fails, we:
//   1) Log the user out (clear cookies via /api/auth/logout).
//   2) Show a blocking modal that the user cannot dismiss.
//
// In dev / when the server has no allowlist configured, the check is permissive
// and never blocks. Real production deployments should set APP_OFFICIAL_HOSTS.

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // re-verify every 10 minutes
const STORAGE_KEY = "contractai.integrity.blocked";

export function IntegrityGuard() {
  const [blocked, setBlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const res = await fetch(`${base}/api/security/integrity`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return; // server error — fail open, do not block
        const data = (await res.json()) as { official?: boolean };
        if (cancelled) return;

        if (data.official === false) {
          // Force logout, then block UI.
          try {
            await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "include" });
          } catch { /* ignore */ }
          try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
          setBlocked(true);
        } else {
          try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      } catch {
        // Network error — fail open, do not block legitimate users.
      }
    }

    void check();
    const id = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!blocked) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
      data-testid="integrity-block-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="integrity-title"
    >
      <div className="w-full max-w-md bg-card border border-destructive/40 rounded-2xl p-6 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 id="integrity-title" className="text-lg font-bold mb-2">Unofficial app detected</h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          You're using an unofficial copy of ContractAI. For your security and account
          protection, you've been signed out. Please use the official app from the App Store,
          Google Play, or contractai.app.
        </p>
        <a
          href="https://contractai.app"
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90"
        >
          Go to official app
        </a>
      </div>
    </div>
  );
}
