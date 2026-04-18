import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { History, Loader2, FileText, ArrowLeft, Lock, Filter } from "lucide-react";
import AppLayout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Record = {
  id: string;
  action: string;
  contractId: string | null;
  riskScore: number | null;
  contractType: string | null;
  metadata: { filename?: string; riskCategory?: string } | null;
  createdAt: string;
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 20) return "text-orange-600";
  return "text-destructive";
}

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [planLimit, setPlanLimit] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalMatching, setTotalMatching] = useState(0);
  const [contractTypes, setContractTypes] = useState<string[]>([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [type, setType] = useState("all");

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (minScore) p.set("minScore", minScore);
    if (maxScore) p.set("maxScore", maxScore);
    if (type && type !== "all") p.set("type", type);
    return p.toString();
  }, [from, to, minScore, maxScore, type]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/audit/history${queryString ? `?${queryString}` : ""}`, { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message ?? "Could not load history");
        }
        const data = await res.json();
        if (cancelled) return;
        setRecords(data.records ?? []);
        setPlanLimit(data.planLimit);
        setTruncated(data.truncated ?? false);
        setTotalMatching(data.totalMatching ?? 0);
        setContractTypes(data.contractTypes ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryString]);

  function clearFilters() {
    setFrom(""); setTo(""); setMinScore(""); setMaxScore(""); setType("all");
  }

  return (
    <AppLayout
      user={user ? { email: user.email, plan: user.plan, contractsUsed: user.contractsUsed, contractsLimit: 0 } : null}
      onLogout={handleLogout}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          data-testid="link-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <History className="w-7 h-7 text-primary" />
              Audit Log & History
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {planLimit === null
                ? "Showing all your contract analyses (unlimited history)."
                : `Showing your most recent ${planLimit} analyses (${user?.plan ?? "free"} plan limit).`}
            </p>
          </div>
          {planLimit !== null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-lg text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Upgrade to Legal Partner for unlimited history</span>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Filters</h2>
            <button onClick={clearFilters} className="ml-auto text-xs text-primary hover:underline" data-testid="clear-filters">Clear</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-background border border-input rounded-lg px-2 py-1.5 text-sm" data-testid="filter-from" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-background border border-input rounded-lg px-2 py-1.5 text-sm" data-testid="filter-to" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Min score</label>
              <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-2 py-1.5 text-sm" data-testid="filter-min-score" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max score</label>
              <input type="number" min={0} max={100} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="100" className="w-full bg-background border border-input rounded-lg px-2 py-1.5 text-sm" data-testid="filter-max-score" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Contract type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-background border border-input rounded-lg px-2 py-1.5 text-sm" data-testid="filter-type">
                <option value="all">All types</option>
                {contractTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">{error}</div>
        ) : records.length === 0 ? (
          <div className="bg-muted/40 border border-border rounded-2xl p-12 text-center">
            <History className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">No analyses match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing filters or analyze a contract first.</p>
            <Button onClick={() => setLocation("/contracts/upload")} className="mt-4">Upload contract</Button>
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              {totalMatching} record{totalMatching === 1 ? "" : "s"} match{totalMatching === 1 ? "es" : ""} your filters
              {truncated && planLimit !== null && (
                <span className="text-amber-700 ml-2">(showing {planLimit} due to plan limit)</span>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => r.contractId && setLocation(`/contracts/${r.contractId}`)}
                  data-testid={`history-row-${r.id}`}
                >
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.metadata?.filename ?? "Contract"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.contractType ?? "Unknown type"} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${scoreColor(r.riskScore)}`}>
                      {r.riskScore ?? "—"}<span className="text-xs font-normal">/100</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{r.metadata?.riskCategory ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
