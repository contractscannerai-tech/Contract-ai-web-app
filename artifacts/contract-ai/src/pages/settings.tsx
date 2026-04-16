import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LogOut, Crown, User, FileText, Trash2, Shield,
  AlertTriangle, Loader2, ExternalLink, Sun, Moon,
  Gift, Copy, Check, Globe,
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import AppLayout from "@/components/layout";
import { useTheme } from "@/lib/theme";
import { useI18n, LANGUAGES } from "@/lib/i18n";

const planBadge: Record<string, { label: string; className: string }> = {
  free:    { label: "Starter",       className: "bg-muted text-muted-foreground border-muted" },
  pro:     { label: "Pro",           className: "bg-primary/10 text-primary border-primary/20" },
  premium: { label: "Legal Partner", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe();
  const logout = useLogout();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [referralData, setReferralData] = useState<{
    referralCode: string;
    totalReferrals: number;
    totalScansAwarded: number;
  } | null>(null);
  const [referralInput, setReferralInput] = useState("");
  const [claimingReferral, setClaimingReferral] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/code", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setReferralData(data as typeof referralData))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.toLowerCase() !== "delete") return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/auth/me", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Server error ${res.status}`);
      }
      queryClient.clear();
      setLocation("/");
    } catch (err) {
      toast({
        title: "Deletion failed",
        description: err instanceof Error ? err.message : "Account deletion failed due to a server error. Please try again or contact support.",
        variant: "destructive",
      });
      setDeletingAccount(false);
    }
  }

  async function handleClaimReferral() {
    if (!referralInput.trim()) return;
    setClaimingReferral(true);
    try {
      const res = await fetch("/api/referrals/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ referralCode: referralInput.trim() }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Failed to apply referral code");
      toast({ title: "Referral applied", description: data.message });
      setReferralInput("");
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
    } catch (err) {
      toast({
        title: "Referral failed",
        description: err instanceof Error ? err.message : "Could not apply referral code",
        variant: "destructive",
      });
    } finally {
      setClaimingReferral(false);
    }
  }

  function copyReferralCode() {
    if (referralData?.referralCode) {
      navigator.clipboard.writeText(referralData.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const badge = planBadge[user?.plan ?? "free"];

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-8">{t("settings.title")}</h1>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.account")}</h2>
          {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium" data-testid="text-email">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.accountEmail")}</p>
                </div>
              </div>
              {user.createdAt && (
                <p className="text-sm text-muted-foreground">{t("settings.memberSince")} {formatDate(user.createdAt)}</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.plan")}</h2>
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
                      {user.contractsUsed} {user.contractsLimit === 999 ? t("settings.unlimitedUsed") : t("settings.contractsUsed", { limit: String(user.contractsLimit) })}
                      {(user as Record<string, unknown>).bonusScans ? ` (${t("settings.bonus", { count: String((user as Record<string, unknown>).bonusScans) })})` : ""}
                    </p>
                  </div>
                </div>
              </div>
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
                  <Crown className="w-4 h-4" /> {t("settings.upgradePlan")}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" /> {t("settings.language")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  lang === l.code
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                <span>{l.flag}</span>
                <span className="truncate">{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.appearance")}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                theme === "light" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
              }`}
            >
              <Sun className="w-4 h-4" /> {t("settings.light")}
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                theme === "dark" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
              }`}
            >
              <Moon className="w-4 h-4" /> {t("settings.dark")}
            </button>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Gift className="w-4 h-4" /> {t("settings.referral")}
          </h2>
          {referralData ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t("settings.referralCode")}</p>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-2 rounded-lg text-sm font-mono flex-1">{referralData.referralCode}</code>
                  <Button variant="outline" size="sm" onClick={copyReferralCode} className="gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t("settings.copied") : t("settings.copy")}
                  </Button>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-2xl font-bold">{referralData.totalReferrals}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.referrals")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{referralData.totalScansAwarded}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.bonusScansEarned")}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p>{t("settings.shareCodeInfo")}</p>
                <p>{t("settings.signUpBonus")}</p>
                <p>{t("settings.proBonus")}</p>
                <p>{t("settings.premiumBonus")}</p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-20" />
          )}

          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">{t("settings.haveCode")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                placeholder={t("settings.enterCode")}
                className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button size="sm" onClick={() => void handleClaimReferral()} disabled={!referralInput.trim() || claimingReferral}>
                {claimingReferral ? t("settings.applying") : t("settings.apply")}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.quickActions")}</h2>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start gap-2" onClick={() => setLocation("/contracts")} data-testid="button-view-contracts">
              <FileText className="w-4 h-4" /> {t("settings.viewContracts")}
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => setLocation("/contracts/upload")} data-testid="button-upload">
              <FileText className="w-4 h-4" /> {t("settings.uploadNew")}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.privacyData")}</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("settings.privacy1")} <strong className="text-foreground">{t("settings.privacy1b")}</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("settings.privacy2")} <strong className="text-foreground">{t("settings.privacy2b")}</strong> {t("settings.privacy2c")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("settings.privacy3")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t("settings.privacy4a")} <strong className="text-foreground">{t("settings.privacy4b")}</strong>.</span>
            </div>
          </div>
          <a
            href="https://contractscannerai-tech.github.io/Contractai-privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:opacity-80 transition-opacity"
            data-testid="button-privacy-policy"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t("settings.readPrivacy")}
          </a>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">{t("settings.session")}</h2>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            onClick={handleLogout}
            disabled={logout.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            {logout.isPending ? t("settings.signingOut") : t("settings.signOut")}
          </Button>
        </div>

        <div className="bg-card border border-destructive/20 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-sm text-destructive uppercase tracking-wider mb-1">{t("settings.dangerZone")}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t("settings.dangerDesc")}
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-account-start"
            >
              <Trash2 className="w-4 h-4" /> {t("settings.deleteAccount")}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive mb-2">{t("settings.deleteWarning")}</p>
                  <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                    <li>{t("settings.deleteItem1")}</li>
                    <li>{t("settings.deleteItem2")}</li>
                    <li>{t("settings.deleteItem3")}</li>
                    <li>{t("settings.deleteItem4")}</li>
                  </ul>
                  <p className="mt-2 font-medium text-foreground">{t("settings.cannotUndo")}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  {t("settings.typeDelete", { word: "delete" })}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete"
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/50"
                  data-testid="input-delete-confirm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  disabled={deletingAccount}
                  data-testid="button-delete-cancel"
                >
                  {t("settings.cancel")}
                </Button>
                <Button
                  className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteConfirmText.toLowerCase() !== "delete" || deletingAccount}
                  data-testid="button-delete-confirm"
                >
                  {deletingAccount ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t("settings.deleting")}</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> {t("settings.permanentlyDelete")}</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
