import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, FileText, Zap, Crown, Lock } from "lucide-react";
import { useGetMe, useCreateCheckout, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type PlanKey = "free" | "pro" | "premium";

const PLAN_ICONS: Record<PlanKey, React.ReactNode> = {
  free:    <FileText className="w-5 h-5" />,
  pro:     <Zap className="w-5 h-5" />,
  premium: <Crown className="w-5 h-5" />,
};

const PLAN_NAMES: Record<PlanKey, string> = {
  free:    "Starter",
  pro:     "Pro",
  premium: "Legal Partner",
};

const PLAN_DESCS: Record<PlanKey, string> = {
  free:    "Essential contract scanning, free forever.",
  pro:     "More scans, full explanations, photo uploads.",
  premium: "Unlimited everything + exclusive AI tools.",
};

const PLAN_PRICES: Record<PlanKey, string> = {
  free:    "$0",
  pro:     "$29",
  premium: "$99",
};

const PLAN_PERIOD: Record<PlanKey, string> = {
  free:    "forever",
  pro:     "/month",
  premium: "/month",
};

const PLAN_CTA: Record<PlanKey, string> = {
  free:    "Get started free",
  pro:     "Upgrade to Pro",
  premium: "Upgrade to Legal Partner",
};

interface FeatureRow {
  label: string;
  free: boolean | string;
  pro: boolean | string;
  premium: boolean | string;
  premiumOnly?: boolean;
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Contract scans per month",       free: "3",          pro: "20",          premium: "Unlimited" },
  { label: "PDF contract analysis",          free: true,         pro: true,          premium: true },
  { label: "AI risk detection",              free: "Names only", pro: "Full detail", premium: "Full detail" },
  { label: "Key clause extraction",          free: "Names only", pro: "Full detail", premium: "Full detail" },
  { label: "Plain-English summaries",        free: true,         pro: true,          premium: true },
  { label: "Photo / image OCR scanning",     free: false,        pro: true,          premium: true },
  { label: "Contract history & archive",     free: false,        pro: true,          premium: true },
  { label: "AI chat — ask any question",     free: false,        pro: false,         premium: true },
  { label: "Renegotiation recommendations",  free: false,        pro: false,         premium: true },
  { label: "Priority processing & support",  free: false,        pro: false,         premium: true },
];

const AI_TOOL_ROWS: FeatureRow[] = [
  { label: "Document Drafting — AI assists in drafting legal documents",       free: false, pro: false, premium: true, premiumOnly: true },
  { label: "Application Drafting — AI assists in writing cover letters",       free: false, pro: false, premium: true, premiumOnly: true },
  { label: "Resume Builder — AI assists in building ATS-optimized resumes",    free: false, pro: false, premium: true, premiumOnly: true },
  { label: "Career Guidance — AI assists with career paths and insights",      free: false, pro: false, premium: true, premiumOnly: true },
  { label: "Document Templates Library",                                       free: "Preview", pro: "Preview", premium: "Full access", premiumOnly: false },
];

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. You can cancel your subscription at any time and you'll retain access until the end of your billing period.",
  },
  {
    q: "What file formats are supported?",
    a: "PDF contracts are supported on all plans. Pro and Legal Partner plans also support image uploads (JPEG, PNG, WebP) with OCR text extraction.",
  },
  {
    q: "How accurate is the AI analysis?",
    a: "Our AI is powered by Llama-3.3-70b via GROQ and is highly accurate for identifying common risk patterns and clause types. It is not a substitute for professional legal advice.",
  },
  {
    q: "Is my contract data secure?",
    a: "Your uploaded files are processed in-memory and never permanently stored. Raw contract text is deleted within seconds of analysis completing. Only the structured results are retained.",
  },
  {
    q: "What are the AI Tools?",
    a: "AI Tools are premium features that assist you in drafting documents, writing job applications, building resumes, and exploring career guidance — all powered by AI. They're included exclusively in the Legal Partner plan.",
  },
  {
    q: "Do the AI Tools replace lawyers or career professionals?",
    a: "No. The AI tools assist you in drafting and exploring options as a starting point. For legal matters, always have a qualified attorney review final documents. For career decisions, consult professionals in your field.",
  },
];

function FeatureValue({ value, highlight }: { value: boolean | string; highlight: boolean }) {
  if (value === false) {
    return <XCircle className={`w-4 h-4 flex-shrink-0 ${highlight ? "text-primary-foreground/30" : "text-muted-foreground/40"}`} />;
  }
  if (value === true) {
    return <CheckCircle className={`w-4 h-4 flex-shrink-0 ${highlight ? "text-primary-foreground" : "text-primary"}`} />;
  }
  return (
    <span className={`text-xs font-semibold ${highlight ? "text-primary-foreground" : "text-foreground"}`}>
      {value}
    </span>
  );
}

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
        toast({ title: "Payment error", description: "Could not create checkout session.", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start checkout. Please try again.";
      toast({ title: "Payment error", description: msg, variant: "destructive" });
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
            Start free. The Starter plan shows you where risks exist. Upgrade to learn why they matter — and how to fight back.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {planKeys.map((planKey) => {
            const isCurrentPlan = user?.plan === planKey;
            const isLoading = loadingPlan === planKey;
            const highlight = planKey === "premium";

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
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent text-accent-foreground">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${highlight ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
                  {PLAN_ICONS[planKey]}
                </div>

                <h3 className="text-xl font-bold mb-1">{PLAN_NAMES[planKey]}</h3>
                <p className={`text-sm mb-4 ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {PLAN_DESCS[planKey]}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{PLAN_PRICES[planKey]}</span>
                  <span className={`text-sm ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {PLAN_PERIOD[planKey]}
                  </span>
                </div>

                <div className="space-y-2.5 mb-8 flex-1">
                  {FEATURE_ROWS.map((row, i) => {
                    const val = row[planKey];
                    const isIncluded = val !== false;
                    return (
                      <div key={i} className="flex items-start gap-2.5 text-sm" data-testid={`feature-${planKey}-${i}`}>
                        <div className="mt-0.5 flex-shrink-0">
                          <FeatureValue value={val} highlight={highlight} />
                        </div>
                        <span className={
                          !isIncluded
                            ? highlight ? "text-primary-foreground/40" : "text-muted-foreground/50"
                            : highlight ? "text-primary-foreground" : "text-foreground"
                        }>
                          {row.label}
                        </span>
                      </div>
                    );
                  })}

                  <div className={`pt-2 mt-2 border-t ${highlight ? "border-primary-foreground/20" : "border-border"}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      <Lock className="w-3 h-3" /> AI Tools
                    </p>
                    {AI_TOOL_ROWS.map((row, i) => {
                      const val = row[planKey];
                      const isIncluded = val !== false;
                      return (
                        <div key={i} className="flex items-start gap-2.5 text-sm mb-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <FeatureValue value={val} highlight={highlight} />
                          </div>
                          <span className={
                            !isIncluded
                              ? highlight ? "text-primary-foreground/40" : "text-muted-foreground/50"
                              : highlight ? "text-primary-foreground" : "text-foreground"
                          }>
                            {row.label.split(" — ")[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={isCurrentPlan || isLoading}
                  variant={highlight ? "secondary" : "default"}
                  className="w-full"
                  data-testid={`button-select-${planKey}`}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isCurrentPlan ? "Current plan" : PLAN_CTA[planKey]}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mb-14">
          <h2 className="text-xl font-bold text-center mb-6">What's included in every plan</h2>
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-4 bg-muted/50 border-b border-border px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">Feature</div>
              <div className="text-center">Starter</div>
              <div className="text-center">Pro</div>
              <div className="text-center">Legal Partner</div>
            </div>

            <div className="divide-y divide-border">
              {FEATURE_ROWS.map((row, i) => (
                <div key={i} className="grid grid-cols-4 px-6 py-3.5 text-sm items-center hover:bg-muted/20 transition-colors">
                  <div className="col-span-1 text-foreground/80">{row.label}</div>
                  {(["free", "pro", "premium"] as PlanKey[]).map((p) => (
                    <div key={p} className="flex justify-center">
                      <FeatureValue value={row[p]} highlight={false} />
                    </div>
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-4 px-6 py-3.5 bg-amber-500/5 items-center">
                <div className="col-span-1 text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" /> AI Tools
                </div>
                <div className="col-span-3 text-xs text-muted-foreground text-center">Premium-exclusive features</div>
              </div>

              {AI_TOOL_ROWS.map((row, i) => (
                <div key={i} className="grid grid-cols-4 px-6 py-3.5 text-sm items-center hover:bg-muted/20 transition-colors">
                  <div className="col-span-1 text-foreground/80">
                    <span>{row.label.split(" — ")[0]}</span>
                    {row.label.includes(" — ") && (
                      <span className="block text-xs text-muted-foreground mt-0.5">{row.label.split(" — ")[1]}</span>
                    )}
                  </div>
                  {(["free", "pro", "premium"] as PlanKey[]).map((p) => (
                    <div key={p} className="flex justify-center">
                      <FeatureValue value={row[p]} highlight={false} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-muted/40 border border-border rounded-2xl p-8 mb-14 text-center">
          <h2 className="text-lg font-semibold mb-2">Free vs. Legal Partner — the key difference</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The Starter plan tells you a risk exists at Section 4.2. The Legal Partner plan tells you exactly what it means, why it could cost you money, and how to renegotiate it before you sign. Plus exclusive AI tools that assist you in drafting documents, building resumes, and planning your career. One plan protects your contracts. The other transforms what you can do with them.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Common questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq, i) => (
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
