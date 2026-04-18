import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Sparkles, Loader2, Copy, Check, ChevronLeft, AlertCircle, Download } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import AppLayout from "@/components/layout";
import { UpgradeModal } from "@/components/upgrade-modal";

export default function ResumePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { lang } = useI18n();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [summary, setSummary] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = user?.plan === "premium" || user?.plan === "team";

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPremium) { setShowUpgrade(true); return; }
    if (!name.trim()) { setError("Your full name is required."); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, phone, targetRole, summary, experience, education, skills, language: lang }),
      });

      const data = await res.json() as { success?: boolean; resume?: string; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to generate resume");
      setResult(data.resume ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resume generation failed. Please try again.";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}_Resume.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Resume Builder</h1>
            <p className="text-sm text-muted-foreground">AI assists you in building a professional, ATS-optimized resume</p>
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
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Legal Partner ($99/mo) to build polished, ATS-ready resumes with AI.</p>
              <Button size="sm" className="mt-2" onClick={() => setShowUpgrade(true)}>Upgrade Now</Button>
            </div>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 mt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" disabled={loading} required />
              </div>
              <div className="space-y-1.5">
                <Label>Target Role</Label>
                <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g., Senior Software Engineer" disabled={loading} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" disabled={loading} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Professional Summary (optional — AI will generate if blank)</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g., Results-driven engineer with 7 years building scalable APIs..."
                rows={2}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Work Experience</Label>
              <Textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g., Senior Engineer at Stripe (2021–present): Built payment gateway processing $50M/day. Engineer at Shopify (2018–2021): Led checkout redesign."
                rows={5}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Education</Label>
              <Textarea
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="e.g., B.S. Computer Science, MIT, 2018"
                rows={2}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Skills</Label>
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g., Python, TypeScript, React, AWS, PostgreSQL, Agile, Team Leadership"
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
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Building resume…</> : <><Sparkles className="w-4 h-4" /> Build My Resume</>}
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
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Your Resume</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadResult} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={copyResult} className="gap-1.5">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </Button>
              </div>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground/90 max-h-[600px] overflow-y-auto">
                {result}
              </pre>
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground">
                ✏️ AI-assisted resume — review and personalise before submitting. Add specific metrics and achievements that set you apart.
              </p>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="AI Resume Builder"
        requiredPlan="premium"
      />
    </AppLayout>
  );
}
