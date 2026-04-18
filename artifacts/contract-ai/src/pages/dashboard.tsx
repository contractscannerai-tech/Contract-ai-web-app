import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Upload, TrendingUp, AlertTriangle, CheckCircle,
  ChevronRight, BarChart3,
} from "lucide-react";
import {
  useGetDashboardStats, useGetRecentActivity, useGetMe, useLogout,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRelativeTime } from "@/lib/utils";
import AppLayout from "@/components/layout";
import { AiThoughtBubble } from "@/components/ai-thought-bubble";
import { FeatureGrid } from "@/components/feature-grid";
import { useI18n } from "@/lib/i18n";
import { ReviewPromptModal } from "@/components/review-prompt-modal";

const riskBadge = (level: string | null) => {
  if (!level) return null;
  const cfg: Record<string, { cls: string; dot: string }> = {
    high:   { cls: "bg-destructive/10 text-destructive border-destructive/20",   dot: "bg-destructive"   },
    medium: { cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",     dot: "bg-yellow-500"    },
    low:    { cls: "bg-green-500/10 text-green-700 border-green-500/20",         dot: "bg-green-500"     },
  };
  const c = cfg[level];
  if (!c) return null;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {level}
    </span>
  );
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const { t } = useI18n();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  const planLabel =
    !user ? "..." :
    user.plan === "premium" ? "Legal Partner" :
    user.plan === "pro" ? "Pro" : "Starter";

  const planColor =
    user?.plan === "premium" ? "text-amber-600 bg-amber-500/10 border-amber-500/20" :
    user?.plan === "pro"     ? "text-primary bg-primary/10 border-primary/20" :
                               "text-muted-foreground bg-muted border-border";

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <ReviewPromptModal trigger={user?.contractsUsed ?? 0} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            {user && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${planColor}`}>
                  {planLabel}
                </span>
                <span className="text-sm text-muted-foreground">
                  {user.contractsLimit === 999
                    ? `${user.contractsUsed} ${t("dashboard.contractsAnalyzed")}`
                    : `${user.contractsUsed} / ${user.contractsLimit} ${t("dashboard.contractsUsed")}`}
                </span>
              </div>
            )}
          </div>
          <Button onClick={() => setLocation("/contracts/upload")} className="gap-2 shadow-sm" data-testid="button-upload-contract">
            <Upload className="w-4 h-4" />
            {t("dashboard.uploadContract")}
          </Button>
        </div>

        <AiThoughtBubble />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboard.quickActions")}</h2>
            {user?.plan === "free" && (
              <button
                onClick={() => setLocation("/pricing")}
                className="text-xs text-primary font-medium hover:underline underline-offset-2"
              >
                {t("dashboard.unlockFeatures")}
              </button>
            )}
          </div>
          <FeatureGrid userPlan={(user?.plan as "free" | "pro" | "premium") ?? "free"} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : stats ? (
            <>
              {[
                { icon: <FileText className="w-5 h-5" />,     label: t("dashboard.stats.total"), value: stats.totalContracts,      color: "text-primary",     bg: "bg-primary/8" },
                { icon: <CheckCircle className="w-5 h-5" />,  label: t("dashboard.stats.analyzed"),        value: stats.analyzedContracts,    color: "text-green-600",   bg: "bg-green-500/8" },
                { icon: <AlertTriangle className="w-5 h-5" />,label: t("dashboard.stats.highRisk"),        value: stats.highRiskContracts,    color: "text-destructive", bg: "bg-destructive/8" },
                { icon: <BarChart3 className="w-5 h-5" />,    label: t("dashboard.stats.planUsage"),       value: `${stats.planUsagePercent}%`,color: "text-accent",     bg: "bg-accent/8" },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-card-border rounded-xl p-5 shadow-sm" data-testid={`stat-card-${i}`}>
                  <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center ${s.color} mb-3`}>
                    {s.icon}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {stats && (
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t("dashboard.planUsage")}</span>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                {stats.contractsUsed} / {stats.contractsLimit === 999 ? t("dashboard.unlimited") : stats.contractsLimit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                  stats.planUsagePercent >= 90 ? "bg-destructive" :
                  stats.planUsagePercent >= 70 ? "bg-yellow-500" :
                  "bg-primary"
                }`}
                style={{ width: `${Math.min(stats.planUsagePercent, 100)}%` }}
              />
            </div>
            {stats.plan !== "premium" && stats.planUsagePercent >= 80 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{t("dashboard.upgradeWarning")}</p>
                <Button size="sm" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-upgrade-usage">
                  {t("dashboard.upgradePlan")}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t("dashboard.recentActivity")}</h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-view-all-contracts">
              {t("dashboard.viewAll")} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {recentLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : !recent || recent.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">{t("dashboard.noContracts")}</p>
              <p className="text-xs text-muted-foreground mb-5">{t("dashboard.noContractsDesc")}</p>
              <Button size="sm" onClick={() => setLocation("/contracts/upload")} data-testid="button-first-upload">
                {t("dashboard.uploadFirst")}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors duration-150 cursor-pointer group"
                  onClick={() => setLocation(`/contracts/${item.contractId}`)}
                  data-testid={`activity-item-${item.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.filename}</p>
                      <p className="text-xs text-muted-foreground">{item.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.riskLevel && riskBadge(item.riskLevel)}
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
