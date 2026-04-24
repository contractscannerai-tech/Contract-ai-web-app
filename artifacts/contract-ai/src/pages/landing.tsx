import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Zap, FileText, CheckCircle, Star, ArrowRight,
  Lock, AlertTriangle, BookOpen, PenLine, User, TrendingUp, LayoutTemplate,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReviewBubbles } from "@/components/review-bubbles";
import { useNetworkGuard } from "@/components/network-guard";

const PRIVACY_URL = "https://contractscannerai-tech.github.io/Contractai-privacy-policy/";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { requireOnline } = useNetworkGuard();

  function goToAuth() {
    if (requireOnline("sign in")) setLocation("/auth");
  }

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
              Pricing
            </Button>
            <Button variant="ghost" size="sm" onClick={goToAuth} data-testid="link-login">
              Login
            </Button>
            <Button size="sm" onClick={goToAuth} data-testid="button-get-started">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-32">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
          AI-Powered Legal Analysis
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 max-w-3xl leading-tight">
          Understand any contract
          <span className="text-primary"> in seconds.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
          Your contract analyzer in your pocket — without paying expensive lawyers. Upload a PDF and get an instant plain-English summary, risk analysis, and key clause extraction.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <Button size="lg" onClick={goToAuth} className="gap-2 px-8" data-testid="button-hero-cta">
            Analyze your first contract free
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => setLocation("/pricing")} data-testid="button-view-plans">
            View plans
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">No credit card required. Free plan includes 3 contracts.</p>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to review contracts confidently</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Stop signing contracts you don't fully understand. ContractAI gives you the clarity lawyers charge hundreds per hour for.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-5 h-5" />,
                title: "Instant AI Summary",
                desc: "Get a plain-English summary of any contract in seconds. No legal jargon, no confusion — just clarity.",
              },
              {
                icon: <AlertTriangle className="w-5 h-5" />,
                title: "Risk Detection",
                desc: "AI flags clauses that could hurt you — unfair penalties, liability traps, one-sided termination rights.",
              },
              {
                icon: <BookOpen className="w-5 h-5" />,
                title: "Key Clause Extraction",
                desc: "The most important provisions highlighted and explained so you know exactly what you're agreeing to.",
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
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Legal Partner — Premium AI Tools
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight mb-4">More than just contracts</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Upgrade to Legal Partner and unlock powerful AI tools that assist you throughout your professional life.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <PenLine className="w-5 h-5" />,
                title: "Document Drafting",
                desc: "AI assists you in drafting professional legal documents — NDAs, employment contracts, service agreements, and more.",
              },
              {
                icon: <User className="w-5 h-5" />,
                title: "Resume Builder",
                desc: "AI assists you in building a polished, ATS-optimized resume tailored to your target role and industry.",
              },
              {
                icon: <TrendingUp className="w-5 h-5" />,
                title: "Career Insights",
                desc: "AI assists you with personalised career path recommendations, skill guidance, and a 90-day action plan.",
              },
              {
                icon: <LayoutTemplate className="w-5 h-5" />,
                title: "Document Templates",
                desc: "Access a library of professional document templates. AI assists you in customising any template instantly.",
              },
            ].map((tool, i) => (
              <div
                key={i}
                className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                data-testid={`ai-tool-card-${i}`}
              >
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 mb-3 group-hover:bg-amber-500/20 transition-colors">
                  {tool.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{tool.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed mb-3">{tool.desc}</p>
                <button
                  onClick={goToAuth}
                  className="text-xs text-primary font-medium hover:underline underline-offset-2 flex items-center gap-1"
                >
                  Get started <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-xs text-muted-foreground mb-3">AI tools assist you as a starting point — not a replacement for qualified professionals.</p>
            <Button variant="outline" onClick={() => setLocation("/pricing")} className="gap-2">
              <Lock className="w-3.5 h-3.5" /> See Legal Partner plan
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-muted-foreground">Three steps to contract clarity</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Upload your PDF", desc: "Drag and drop or select your contract PDF. We accept any legal document up to 10MB." },
              { step: "02", title: "AI analyzes it", desc: "Our AI reads every clause, flags risks, and distills the key points into plain language." },
              { step: "03", title: "Review and decide", desc: "See the summary, risks, and key clauses. Chat with AI for deeper questions. Sign with confidence." },
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

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Trusted by thousands</h2>
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

      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
          <p className="text-muted-foreground mb-10">Start free. Upgrade when you need more.</p>
          <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-see-pricing">
            See full pricing details
          </Button>
        </div>
      </section>

      <section className="py-16 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
            {[
              { icon: <Shield className="w-5 h-5" />, label: "Bank-grade encryption" },
              { icon: <Lock className="w-5 h-5" />, label: "Data never sold" },
              { icon: <CheckCircle className="w-5 h-5" />, label: "SOC2 compliant infrastructure" },
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
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to stop guessing?</h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">Start analyzing contracts today. It's free to get started.</p>
          <Button size="lg" variant="secondary" onClick={goToAuth} className="gap-2" data-testid="button-cta-bottom">
            Start for free <ArrowRight className="w-4 h-4" />
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
          <p className="text-xs text-muted-foreground">© 2026 ContractAI. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
            <button onClick={goToAuth} className="hover:text-foreground transition-colors">Login</button>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>

      <ReviewBubbles />
    </div>
  );
}
