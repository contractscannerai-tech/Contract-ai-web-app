import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, FileText, Zap, Crown } from "lucide-react";
import { useGetMe, useCreateCheckout, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

type PlanKey = "free" | "pro" | "premium";

const PLAN_ICONS: Record<PlanKey, React.ReactNode> = {
  free: <FileText className="w-5 h-5" />,
  pro: <Zap className="w-5 h-5" />,
  premium: <Crown className="w-5 h-5" />,
};

const PLAN_PRICE_AMOUNTS: Record<PlanKey, string> = {
  free: "$0",
  pro: "$29",
  premium: "$99",
};

const PLAN_PERIOD_KEYS: Record<PlanKey, string> = {
  free: "pricing.forever",
  pro: "pricing.perMonth",
  premium: "pricing.perMonth",
};

const PLAN_FEATURES_INCLUDED: Record<PlanKey, boolean[]> = {
  free: [true, true, true, true, false, false, false, false],
  pro: [true, true, true, true, true, true, false, false],
  premium: [true, true, true, true, true, true, true, true],
};

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { t } = useI18n();

  const { data: user } = useGetMe();
  const logout = useLogout();
  const createCheckout = useCreateCheckout();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  async function handleSelectPlan(planKey: PlanKey) {
    if (planKey === "free") {
      setLocation(user ? "/dashboard" : "/auth");
      return;
    }

    if (!user) {
      setLocation("/auth");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const result = await createCheckout.mutateAsync({ data: { plan: planKey } });
      if (result.success && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        toast({ title: t("pricing.paymentError"), description: t("pricing.checkoutFailed"), variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("pricing.checkoutRetry");
      toast({ title: t("pricing.paymentError"), description: msg, variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  }

  const planKeys: PlanKey[] = ["free", "pro", "premium"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2" data-testid="link-logo">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">ContractAI</span>
          </button>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} data-testid="link-dashboard">{t("nav.dashboard")}</Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">{t("nav.signOut")}</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} data-testid="link-login">{t("nav.login")}</Button>
                <Button size="sm" onClick={() => setLocation("/auth")} data-testid="button-signup">{t("nav.getStarted")}</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">{t("pricing.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {planKeys.map((planKey) => {
            const isCurrentPlan = user?.plan === planKey;
            const isLoading = loadingPlan === planKey;
            const highlight = planKey === "premium";
            const badge = t(`pricing.plan.${planKey}.badge`);
            const hasBadge = badge !== `pricing.plan.${planKey}.badge`;
            const features = Array.from({ length: 8 }, (_, i) => ({
              text: t(`pricing.feat.${planKey}.${i}`),
              included: PLAN_FEATURES_INCLUDED[planKey][i],
            }));

            return (
              <div
                key={planKey}
                className={`relative rounded-2xl border p-7 flex flex-col ${
                  highlight
                    ? "bg-primary text-primary-foreground border-primary shadow-xl"
                    : "bg-card border-card-border shadow-sm"
                }`}
                data-testid={`plan-card-${planKey}`}
              >
                {hasBadge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${highlight ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground border border-border"}`}>
                      {badge}
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${highlight ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
                  {PLAN_ICONS[planKey]}
                </div>

                <h3 className="text-xl font-bold mb-1">{t(`pricing.plan.${planKey}.name`)}</h3>
                <p className={`text-sm mb-4 ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {t(`pricing.plan.${planKey}.desc`)}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{PLAN_PRICE_AMOUNTS[planKey]}</span>
                  <span className={`text-sm ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{t(PLAN_PERIOD_KEYS[planKey])}</span>
                </div>

                <div className="space-y-2.5 mb-8 flex-1">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm" data-testid={`feature-${planKey}-${i}`}>
                      {feature.included ? (
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-primary-foreground" : "text-primary"}`} />
                      ) : (
                        <XCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-primary-foreground/40" : "text-muted-foreground/50"}`} />
                      )}
                      <span className={feature.included ? "" : highlight ? "text-primary-foreground/50" : "text-muted-foreground/60"}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={isCurrentPlan || isLoading}
                  variant={highlight ? "secondary" : "default"}
                  className="w-full"
                  data-testid={`button-select-${planKey}`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isCurrentPlan ? t("pricing.currentPlan") : t(`pricing.plan.${planKey}.cta`)}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="bg-muted/40 border border-border rounded-2xl p-8 mb-14 text-center">
          <h2 className="text-lg font-semibold mb-2">{t("pricing.comparison.title")}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("pricing.comparison.desc")}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">{t("pricing.faq.title")}</h2>
          <div className="space-y-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="border-b border-border pb-6" data-testid={`faq-${i}`}>
                <h3 className="font-semibold mb-2">{t(`pricing.faq.q${i}`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(`pricing.faq.a${i}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">{t("common.rights")}</p>
        </div>
      </footer>
    </div>
  );
}
