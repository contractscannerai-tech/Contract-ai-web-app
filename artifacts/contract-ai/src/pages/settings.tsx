import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Crown, User, FileText } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import AppLayout from "@/components/layout";

const planBadge: Record<string, { label: string; className: string }> = {
  free: { label: "Free", className: "bg-muted text-muted-foreground border-muted" },
  pro: { label: "Pro", className: "bg-primary/10 text-primary border-primary/20" },
  premium: { label: "Premium", className: "bg-accent/10 text-accent border-accent/20" },
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  const badge = planBadge[user?.plan ?? "free"];

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Settings</h1>

        {/* Account info */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Account</h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium" data-testid="text-email">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Account email</p>
                </div>
              </div>
              {user.createdAt && (
                <div className="text-sm text-muted-foreground">
                  Member since {formatDate(user.createdAt)}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Plan */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Plan</h2>
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : user ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Crown className="w-5 h-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} Plan</p>
                      {badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid="text-usage">
                      {user.contractsUsed} of {user.contractsLimit === 999 ? "Unlimited" : user.contractsLimit} contracts used
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage bar */}
              {user.contractsLimit !== 999 && (
                <div className="mb-4">
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((user.contractsUsed / user.contractsLimit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {user.plan !== "premium" && (
                <Button variant="outline" size="sm" onClick={() => setLocation("/pricing")} className="gap-2" data-testid="button-upgrade">
                  <Crown className="w-4 h-4" />
                  Upgrade plan
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {/* Contract stats */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start gap-2" onClick={() => setLocation("/contracts")} data-testid="button-view-contracts">
              <FileText className="w-4 h-4" />
              View all contracts
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => setLocation("/contracts/upload")} data-testid="button-upload">
              <FileText className="w-4 h-4" />
              Upload new contract
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Session</h2>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            onClick={handleLogout}
            disabled={logout.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            {logout.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
