import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, FileText, Zap, Crown } from "lucide-react";
import { useGetMe, useCreateCheckout, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    key: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for occasional contract reviews",
    icon: <FileText className="w-5 h-5" />,
    features: [
      "3 contracts per month",
      "AI-powered analysis",
      "Risk detection",
      "Key clause extraction",
      "Plain-English summaries",
    ],
    cta: "Get started free",
    highlight: false,
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For freelancers and small business owners",
    icon: <Zap className="w-5 h-5" />,
    features: [
      "50 contracts per month",
      "All Free features",
      "Priority analysis speed",
      "Contract history",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    highlight: false,
  },
  {
    key: "premium" as const,
    name: "Premium",
    price: "$99",
    period: "/month",
    description: "For teams and power users",
    icon: <Crown className="w-5 h-5" />,
    features: [
      "Unlimited contracts",
      "All Pro features",
      "AI chat assistant",
      "Chat with your contract",
      "Priority support",
      "Advanced risk scoring",
    ],
    cta: "Upgrade to Premium",
    highlight: true,
  },
];

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: user } = useGetMe();
  const logout = useLogout();
  const createCheckout = useCreateCheckout();

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  async function handleSelectPlan(planKey: "free" | "pro" | "premium") {
    if (planKey === "free") {
      if (!user) {
        setLocation("/auth");
      } else {
        setLocation("/dashboard");
      }
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
        toast({ title: "Payment error", description: "Could not create checkout session.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Payment error", description: "Could not start checkout. Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  }

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
                <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} data-testid="link-dashboard">Dashboard</Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">Sign out</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} data-testid="link-login">Sign in</Button>
                <Button size="sm" onClick={() => setLocation("/auth")} data-testid="button-signup">Get started</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">Start free. Upgrade when you need more. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {plans.map((plan) => {
            const isCurrentPlan = user?.plan === plan.key;
            const isLoading = loadingPlan === plan.key;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-7 flex flex-col ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground border-primary shadow-xl"
                    : "bg-card border-card-border shadow-sm"
                }`}
                data-testid={`plan-card-${plan.key}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.highlight ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
                  {plan.icon}
                </div>

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{plan.period}</span>
                </div>

                <div className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm" data-testid={`feature-${plan.key}-${i}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-primary-foreground" : "text-primary"}`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.key)}
                  disabled={isCurrentPlan || isLoading}
                  variant={plan.highlight ? "secondary" : "default"}
                  className="w-full"
                  data-testid={`button-select-${plan.key}`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isCurrentPlan ? "Current plan" : plan.cta}
                </Button>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I cancel anytime?", a: "Yes. Cancel your subscription at any time and you'll retain access until the end of your billing period." },
              { q: "Is my data secure?", a: "Yes. All contracts are processed with bank-grade encryption and never shared with third parties or used to train AI models." },
              { q: "Do I need a credit card for the free plan?", a: "No. The free plan requires no payment information. You can upload and analyze 3 contracts immediately after signing up." },
              { q: "What file formats are supported?", a: "We currently support PDF files up to 10MB. Support for other formats is coming soon." },
            ].map((faq, i) => (
              <div key={i} className="border-b border-border pb-6" data-testid={`faq-${i}`}>
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">© 2026 ContractAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
