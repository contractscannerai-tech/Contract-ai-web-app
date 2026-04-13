import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Upload, TrendingUp, AlertTriangle, CheckCircle,
  Clock, ChevronRight, BarChart3
} from "lucide-react";
import {
  useGetDashboardStats, useGetRecentActivity, useGetMe, useLogout,
  getGetDashboardStatsQueryKey, getGetRecentActivityQueryKey, getGetMeQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatRelativeTime } from "@/lib/utils";
import AppLayout from "@/components/layout";

const riskBadge = (level: string | null) => {
  if (!level) return null;
  const colors: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    low: "bg-green-500/10 text-green-700 border-green-500/20",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[level] ?? ""}`}>
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

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  const planColors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-primary/10 text-primary",
    premium: "bg-accent/10 text-accent-foreground",
  };

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {user ? `${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan — ${user.contractsUsed} of ${user.contractsLimit} contracts used` : "Loading..."}
            </p>
          </div>
          <Button onClick={() => setLocation("/contracts/upload")} className="gap-2" data-testid="button-upload-contract">
            <Upload className="w-4 h-4" />
            Upload contract
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : stats ? (
            <>
              {[
                { icon: <FileText className="w-5 h-5" />, label: "Total Contracts", value: stats.totalContracts, color: "text-primary" },
                { icon: <CheckCircle className="w-5 h-5" />, label: "Analyzed", value: stats.analyzedContracts, color: "text-green-600" },
                { icon: <AlertTriangle className="w-5 h-5" />, label: "High Risk", value: stats.highRiskContracts, color: "text-destructive" },
                { icon: <BarChart3 className="w-5 h-5" />, label: "Plan Usage", value: `${stats.planUsagePercent}%`, color: "text-accent" },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-card-border rounded-xl p-4 shadow-sm" data-testid={`stat-card-${i}`}>
                  <div className={`${s.color} mb-2`}>{s.icon}</div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* Plan usage bar */}
        {stats && (
          <div className="bg-card border border-card-border rounded-xl p-5 mb-8 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Plan Usage</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[stats.plan] ?? ""}`}>
                  {stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1)}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{stats.contractsUsed} / {stats.contractsLimit === 999 ? "Unlimited" : stats.contractsLimit}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.planUsagePercent, 100)}%` }}
              />
            </div>
            {stats.plan !== "premium" && stats.planUsagePercent >= 80 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Running low on contracts</p>
                <Button size="sm" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-upgrade-usage">
                  Upgrade plan
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Recent activity */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent Activity</h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-view-all-contracts">
              View all <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {recentLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !recent || recent.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No contracts yet</p>
              <p className="text-xs text-muted-foreground mb-4">Upload your first contract to get started</p>
              <Button size="sm" onClick={() => setLocation("/contracts/upload")} data-testid="button-first-upload">
                Upload a contract
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/contracts/${item.contractId}`)}
                  data-testid={`activity-item-${item.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
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
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
