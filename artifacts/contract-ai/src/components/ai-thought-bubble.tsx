import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

const FALLBACK_TIPS = [
  "Don't forget to check the termination clause — it often hides early exit penalties.",
  "Auto-renewal clauses can lock you in for another full year. Always look for opt-out windows.",
  "IP ownership in contractor agreements often defaults to the hiring company. Verify you retain your work.",
  "Liability caps matter — without them, your financial exposure is unlimited.",
  "Non-compete clauses vary by jurisdiction. Some states won't enforce them at all.",
  "Indemnification clauses can make you responsible for the other party's legal costs.",
  "Payment terms of 'Net-90' mean you wait 3 months to get paid. Negotiate for Net-30.",
  "Force majeure clauses became critical after COVID-19. Make sure yours covers pandemics.",
];

const ROTATION_MS = 6500;
const REFRESH_MS = 5 * 60 * 1000;
const SEEN_STORAGE_KEY = "contractai.insight_seen";

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function persistSeen(seen: Set<string>) {
  try {
    const arr = Array.from(seen).slice(-60);
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export function AiThoughtBubble() {
  const [tips, setTips] = useState<string[]>(FALLBACK_TIPS);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * FALLBACK_TIPS.length));
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const seenRef = useRef<Set<string>>(loadSeen());

  async function fetchInsights(refresh = false) {
    setLoading(true);
    try {
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/dashboard/insights${refresh ? "?refresh=1" : ""}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as { insights?: string[] };
      if (Array.isArray(data.insights) && data.insights.length > 0) {
        // Filter out ones already seen in this session.
        const fresh = data.insights.filter((t) => !seenRef.current.has(t));
        const merged = fresh.length >= 4 ? fresh : data.insights;
        setTips(merged);
        setIdx(0);
        setIsLive(true);
      }
    } catch { /* keep fallback */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void fetchInsights(false);
    const refreshTimer = setInterval(() => void fetchInsights(true), REFRESH_MS);
    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => {
          const next = (i + 1) % tips.length;
          const tip = tips[next];
          if (tip) {
            seenRef.current.add(tip);
            persistSeen(seenRef.current);
          }
          return next;
        });
        setVisible(true);
      }, 500);
    }, ROTATION_MS);
    return () => clearInterval(interval);
  }, [tips]);

  return (
    <div
      className="relative flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 overflow-hidden"
      data-testid="ai-thought-bubble"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="ai-bubble-shimmer" />
      </div>

      <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider flex items-center gap-1.5">
            AI Insight {isLive && <span className="text-[9px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">LIVE</span>}
          </p>
          <button
            onClick={() => void fetchInsights(true)}
            disabled={loading}
            className="text-primary/50 hover:text-primary transition-colors p-1 rounded -mr-1 z-10"
            aria-label="Refresh insights"
            data-testid="refresh-insights"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p
          className="text-sm text-foreground/80 leading-relaxed"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          {tips[idx] ?? FALLBACK_TIPS[0]}
        </p>
      </div>
    </div>
  );
}
