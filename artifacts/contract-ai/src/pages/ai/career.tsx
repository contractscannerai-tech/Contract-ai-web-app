import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, Sparkles, Loader2, ChevronLeft, AlertCircle } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout";
import { UpgradeModal } from "@/components/upgrade-modal";

export default function CareerPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [currentRole, setCurrentRole] = useState("");
  const [interests, setInterests] = useState("");
  const [education, setEducation] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = user?.plan === "premium";

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPremium) { setShowUpgrade(true); return; }
    if (!interests.trim()) { setError("Please describe your interests and strengths."); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/career", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentRole, interests, education, yearsExp, goals }),
      });

      const data = await res.json() as { success?: boolean; guidance?: string; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to generate career guidance");
      setResult(data.guidance ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Career guidance failed. Please try again.";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Career Guidance</h1>
            <p className="text-sm text-muted-foreground">AI assists you with career path insights, skills, and a personalised action plan</p>
          </div>
          {!isPremium && (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              🔒 Premium Only
            </span>
          )}
        </div>

        {!isPremium && (
          <div className="mt-4 mb-6 flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700">Premium feature</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Legal Partner ($99/mo) to receive personalised AI-powered career guidance and insights.</p>
              <Button size="sm" className="mt-2" onClick={() => setShowUpgrade(true)}>Upgrade Now</Button>
            </div>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 mt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Role / Starting Point</Label>
                <Input
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  placeholder="e.g., Junior Developer, Recent graduate, Career changer"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Years of Experience</Label>
                <Input
                  value={yearsExp}
                  onChange={(e) => setYearsExp(e.target.value)}
                  placeholder="e.g., 2 years, 5+ years, None yet"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Your Interests & Strengths *</Label>
              <Textarea
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., I love solving complex problems, building products people use, and working with data. Strong at communication and technical writing. Interested in AI, fintech, and sustainability."
                rows={4}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Education Background</Label>
              <Input
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="e.g., BSc Computer Science, MBA, Self-taught, Bootcamp"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Career Goals</Label>
              <Textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g., Want to move into product management, reach a senior engineering role in 3 years, start my own company eventually, achieve work-life balance..."
                rows={3}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading || !isPremium}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating career guidance…</>
                : <><Sparkles className="w-4 h-4" /> Get My Career Guidance</>}
            </Button>

            {!isPremium && (
              <p className="text-center text-xs text-muted-foreground">
                🔒 Requires{" "}
                <button type="button" onClick={() => setShowUpgrade(true)} className="text-primary underline underline-offset-2">
                  Legal Partner plan
                </button>
              </p>
            )}
          </form>
        </div>

        {result && (
          <div className="mt-6 bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Your Career Guidance Report</span>
            </div>
            <div className="p-5">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {result.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return <h2 key={i} className="text-base font-bold mt-5 mb-2 first:mt-0">{line.replace("## ", "")}</h2>;
                  }
                  if (line.startsWith("### ")) {
                    return <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5">{line.replace("### ", "")}</h3>;
                  }
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return <p key={i} className="font-semibold text-sm mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                  }
                  if (line.startsWith("- ") || line.startsWith("* ")) {
                    return <p key={i} className="text-sm text-foreground/85 pl-3 border-l-2 border-primary/30 my-1">{line.replace(/^[-*]\s/, "")}</p>;
                  }
                  if (line.trim() === "") return <div key={i} className="h-1" />;
                  return <p key={i} className="text-sm text-foreground/85 leading-relaxed my-1">{line}</p>;
                })}
              </div>
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground">
                💡 AI-assisted career insights — use as a starting point. Research specific roles and companies independently, and consider speaking with professionals in your target field.
              </p>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="AI Career Guidance"
        requiredPlan="premium"
      />
    </AppLayout>
  );
}
