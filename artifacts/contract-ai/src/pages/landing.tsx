import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, FileText, CheckCircle, Star, ArrowRight, Lock, AlertTriangle, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReviewBubbles } from "@/components/review-bubbles";
import { useI18n } from "@/lib/i18n";

const PRIVACY_URL = "https://contractscannerai-tech.github.io/Contractai-privacy-policy/";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">ContractAI</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setLocation("/pricing")} data-testid="link-pricing">
              {t("nav.pricing")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} data-testid="link-login">
              {t("nav.login")}
            </Button>
            <Button size="sm" onClick={() => setLocation("/auth")} data-testid="button-get-started">
              {t("nav.getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-32">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
          {t("landing.badge")}
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 max-w-3xl leading-tight">
          {t("landing.hero.title")}
          <span className="text-primary">{t("landing.hero.title2")}</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
          {t("landing.hero.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <Button size="lg" onClick={() => setLocation("/auth")} className="gap-2 px-8" data-testid="button-hero-cta">
            {t("landing.hero.cta")}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-view-plans">
            {t("landing.hero.viewPlans")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("landing.hero.noCC")}</p>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.features.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-5 h-5" />,
                title: t("landing.feat.summary.title"),
                desc: t("landing.feat.summary.desc"),
              },
              {
                icon: <AlertTriangle className="w-5 h-5" />,
                title: t("landing.feat.risk.title"),
                desc: t("landing.feat.risk.desc"),
              },
              {
                icon: <BookOpen className="w-5 h-5" />,
                title: t("landing.feat.clause.title"),
                desc: t("landing.feat.clause.desc"),
              },
            ].map((f, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-feature-${i}`}>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{t("landing.howItWorks.title")}</h2>
            <p className="text-muted-foreground">{t("landing.howItWorks.subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: t("landing.step1.title"), desc: t("landing.step1.desc") },
              { step: "02", title: t("landing.step2.title"), desc: t("landing.step2.desc") },
              { step: "03", title: t("landing.step3.title"), desc: t("landing.step3.desc") },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center" data-testid={`step-${i}`}>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">{t("landing.trusted.title")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Sarah K.", role: "Freelance Designer", review: "I used to just sign contracts hoping for the best. Now I actually understand what I'm agreeing to. Caught a sneaky non-compete clause before it was too late." },
              { name: "Marcus T.", role: "Startup Founder", review: "We reviewed 12 vendor contracts in one afternoon. What would have cost $3,000 in legal fees took us 20 minutes. Incredible time and cost savings." },
              { name: "Priya N.", role: "Real Estate Investor", review: "The risk flagging is remarkable. It highlighted indemnification clauses I would have missed entirely. Worth every penny of the premium plan." },
            ].map((testimonial, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid={`testimonial-${i}`}>
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{testimonial.review}"</p>
                <div>
                  <p className="font-semibold text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">{t("landing.pricing.title")}</h2>
          <p className="text-muted-foreground mb-10">{t("landing.pricing.subtitle")}</p>
          <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-see-pricing">
            {t("landing.pricing.cta")}
          </Button>
        </div>
      </section>

      <section className="py-16 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
            {[
              { icon: <Shield className="w-5 h-5" />, label: t("landing.trust.encryption") },
              { icon: <Lock className="w-5 h-5" />, label: t("landing.trust.data") },
              { icon: <CheckCircle className="w-5 h-5" />, label: t("landing.trust.soc2") },
            ].map((trust, i) => (
              <div key={i} className="flex items-center gap-2">
                {trust.icon}
                <span>{trust.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">{t("landing.cta.title")}</h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">{t("landing.cta.subtitle")}</p>
          <Button size="lg" variant="secondary" onClick={() => setLocation("/auth")} className="gap-2" data-testid="button-cta-bottom">
            {t("landing.cta.button")} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <FileText className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">ContractAI</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("landing.footer.rights")}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">{t("nav.pricing")}</button>
            <button onClick={() => setLocation("/auth")} className="hover:text-foreground transition-colors">{t("nav.login")}</button>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t("landing.footer.privacy")}</a>
          </div>
        </div>
      </footer>

      <ReviewBubbles />
    </div>
  );
}
