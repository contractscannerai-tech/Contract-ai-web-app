import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Crown, Medal, Award, Star, ArrowLeft, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Entry = {
  rank: number; userId: string; displayName: string;
  points: number; signups: number; badge: string; isYou: boolean;
};

const BADGE_STYLES: Record<string, { color: string; bg: string; icon: typeof Trophy }> = {
  Diamond:   { color: "text-cyan-500",  bg: "bg-cyan-500/10",  icon: Crown },
  Gold:      { color: "text-yellow-500",bg: "bg-yellow-500/10",icon: Trophy },
  Silver:    { color: "text-slate-400", bg: "bg-slate-400/10", icon: Medal },
  Bronze:    { color: "text-orange-600",bg: "bg-orange-500/10",icon: Award },
  Newcomer:  { color: "text-muted-foreground", bg: "bg-muted", icon: Star },
};

function rankColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-orange-600";
  return "text-muted-foreground";
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; points: number; badge: string } | null>(null);
  const [monthStart, setMonthStart] = useState<string>("");

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referrals/leaderboard", { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message ?? "Could not load leaderboard");
        }
        const data = await res.json();
        if (cancelled) return;
        setEntries(data.leaderboard ?? []);
        setMyRank(data.myRank ?? null);
        setMonthStart(data.monthStart ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const monthLabel = monthStart
    ? new Date(monthStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <AppLayout
      user={user ? { email: user.email, plan: user.plan, contractsUsed: user.contractsUsed, contractsLimit: 0 } : null}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setLocation("/settings")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          data-testid="link-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Referral Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top referrers for {monthLabel}. Earn 5 points per signup, 20 per Pro upgrade, 50 per Premium/Team upgrade.
          </p>
        </div>

        {myRank && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 mb-6 flex items-center justify-between" data-testid="my-rank-card">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your rank</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                #{myRank.rank} <span className="text-sm font-normal text-muted-foreground">· {myRank.points} pts</span>
              </p>
            </div>
            <BadgePill badge={myRank.badge} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">{error}</div>
        ) : entries.length === 0 ? (
          <div className="bg-muted/40 border border-border rounded-2xl p-12 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium">No referrals yet this month</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to share your referral code and climb the leaderboard.</p>
            <button
              onClick={() => setLocation("/settings")}
              className="mt-4 text-sm font-medium text-primary hover:underline"
              data-testid="link-get-code"
            >
              Get your referral code →
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {entries.map((e) => (
              <div
                key={e.userId}
                className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 ${e.isYou ? "bg-primary/5" : ""}`}
                data-testid={`leaderboard-row-${e.rank}`}
              >
                <div className={`w-10 text-center text-xl font-bold ${rankColor(e.rank)}`}>
                  {e.rank <= 3 ? (e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉") : `#${e.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {e.displayName}
                    {e.isYou && <span className="ml-2 text-xs text-primary">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{e.signups} signup{e.signups === 1 ? "" : "s"}</p>
                </div>
                <BadgePill badge={e.badge} />
                <div className="text-right">
                  <p className="font-bold">{e.points}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function BadgePill({ badge }: { badge: string }) {
  const cfg = BADGE_STYLES[badge] ?? BADGE_STYLES.Newcomer!;
  const Icon = cfg.icon;
  return (
    <div className={`px-3 py-1 rounded-full ${cfg.bg} ${cfg.color} text-xs font-semibold flex items-center gap-1.5`}>
      <Icon className="w-3.5 h-3.5" />
      {badge}
    </div>
  );
}
