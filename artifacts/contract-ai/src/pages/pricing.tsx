import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, FileText, Zap, Crown } from "lucide-react";
import { useGetMe, useCreateCheckout, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Feature = { text: string; included: boolean };

const plans: Array<{
  key: "free" | "pro" | "premium";
  name: string;
  badge?: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  features: Feature[];
  cta: string;
  highlight: boolean;
}> = [
  {
    key: "free",
    name: "Starter",
    badge: "Limited",
    price: "$0",
    period: "forever",
    description: "Basic contract scanning — risk names only, no explanations",
    icon: <FileText className="w-5 h-5" />,
    features: [
      { text: "3 PDF uploads per month", included: true },
      { text: "Risk clause detection (names & locations only)", included: true },
      { text: "Key clause identification (no explanations)", included: true },
      { text: "Short document summary", included: true },
      { text: "Risk explanations & legal context", included: false },
      { text: "Photo / image scanning (OCR)", included: false },
      { text: "Renegotiation recommendations", included: false },
      { text: "AI chat assistant", included: false },
    ],
    cta: "Get started free",
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "Full risk analysis with detailed explanations — for freelancers & businesses",
    icon: <Zap className="w-5 h-5" />,
    features: [
      { text: "20 contracts per month (PDF + Photo)", included: true },
      { text: "Risk clause detection with full explanations", included: true },
      { text: "Key clauses with plain-English breakdown", included: true },
      { text: "Photo / image scanning (OCR)", included: true },
      { text: "Detailed document summary", included: true },
      { text: "Contract history & archive", included: true },
      { text: "Renegotiation recommendations", included: false },
      { text: "AI chat assistant", included: false },
    ],
    cta: "Upgrade to Pro",
    highlight: false,
  },
  {
    key: "premium",
    name: "Legal Partner",
    badge: "Most Powerful",
    price: "$99",
    period: "/month",
    description: "Your AI legal partner — unlimited analysis, negotiation guidance & live chat",
    icon: <Crown className="w-5 h-5" />,
    features: [
      { text: "Unlimited contracts (PDF + Photo)", included: true },
      { text: "Full risk analysis with expert explanations", included: true },
      { text: "Renegotiation recommendations per clause", included: true },
      { text: "AI chat — ask anything about your contract", included: true },
      { text: "Photo / image scanning (OCR)", included: true },
      { text: "Complete contract history", included: true },
      { text: "Priority processing speed", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Become a Legal Partner",
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
    setLocation("/", { replace: true });
  }

  async function handleSelectPlan(planKey: "free" | "pro" | "premium") {
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
        toast({ title: "Payment error", description: "Could not create checkout session.", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start checkout. Please try again.";
      toast({ title: "Payment error", description: msg, variant: "destructive" });
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
                <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} data-testid="link-login">Login</Button>
                <Button size="sm" onClick={() => setLocation("/auth")} data-testid="button-signup">Get started</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Choose your protection level</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free. The Starter plan shows you <em>where</em> risks exist. Upgrade to learn <em>why</em> they matter — and how to fight back.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {plans.map((plan) => {
            const isCurrentPlan = user?.plan === plan.key || (user?.plan === "premium" && plan.key === "premium");
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
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${plan.highlight ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground border border-border"}`}>
                      {plan.badge}
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

                <div className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm" data-testid={`feature-${plan.key}-${i}`}>
                      {feature.included ? (
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-primary-foreground" : "text-primary"}`} />
                      ) : (
                        <XCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-primary-foreground/40" : "text-muted-foreground/50"}`} />
                      )}
                      <span className={feature.included ? "" : plan.highlight ? "text-primary-foreground/50" : "text-muted-foreground/60"}>
                        {feature.text}
                      </span>
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

        {/* Comparison callout */}
        <div className="bg-muted/40 border border-border rounded-2xl p-8 mb-14 text-center">
          <h2 className="text-lg font-semibold mb-2">Free vs. Legal Partner — the key difference</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The Starter plan tells you <strong className="text-foreground">a risk exists at Section 4.2</strong>. The Legal Partner plan tells you{" "}
            <strong className="text-foreground">exactly what it means, why it could cost you money, and how to renegotiate it before you sign</strong>.
            One shows you the iceberg. The other shows you how to steer around it.
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I cancel anytime?", a: "Yes. Cancel your subscription at any time and you'll retain access until the end of your billing period. No questions asked." },
              { q: "Is my data secure?", a: "Yes. All contracts are processed with bank-grade encryption and are never shared with third parties or used to train AI models." },
              { q: "Do I need a credit card for the Starter plan?", a: "No. The Starter plan requires no payment information. Sign up and analyze your first contract in minutes." },
              { q: "What file formats are supported?", a: "PDF files work on all plans. Photo uploads (JPEG, PNG, WebP) are available on Pro and Legal Partner plans, powered by OCR scanning." },
              { q: "What does 'renegotiation recommendations' mean?", a: "On the Legal Partner plan, after analyzing your contract, our AI suggests specific changes you should request before signing — for example: 'Ask that the termination clause require 30 days notice instead of immediate termination.' These are actionable negotiation points, not generic advice." },
              { q: "What's the AI chat assistant?", a: "Legal Partner subscribers can have a back-and-forth conversation with our AI about any specific contract. Ask what a clause means, whether a term is standard, or what your options are — unlimited follow-up questions." },
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
