import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles, Loader2, Copy, Check, ChevronLeft, AlertCircle } from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout";
import { UpgradeModal } from "@/components/upgrade-modal";

const DOCUMENT_TYPES = [
  "Non-Disclosure Agreement",
  "Employment Contract",
  "Freelance Service Agreement",
  "Consulting Agreement",
  "Partnership Agreement",
  "Lease Agreement",
  "Software License Agreement",
  "Terms of Service",
  "Purchase Agreement",
  "Settlement Agreement",
];

export default function DraftDocumentPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [documentType, setDocumentType] = useState("");
  const [customType, setCustomType] = useState("");
  const [title, setTitle] = useState("");
  const [parties, setParties] = useState("");
  const [keyTerms, setKeyTerms] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

    const type = documentType === "Other" ? customType : documentType;
    if (!type || !parties) {
      setError("Please select a document type and enter the parties involved.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/draft-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentType: type, title, parties, keyTerms, jurisdiction }),
      });

      const data = await res.json() as { success?: boolean; document?: string; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Failed to generate document");
      setResult(data.document ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Document drafting failed. Please try again.";
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
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Document Drafting</h1>
            <p className="text-sm text-muted-foreground">AI assists you in drafting professional legal documents</p>
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
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Legal Partner ($99/mo) to assist in drafting professional legal documents with AI.</p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={() => setShowUpgrade(true)}>
                Upgrade Now
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 mt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Document Type *</Label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                required
                disabled={loading}
              >
                <option value="">Select document type...</option>
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="Other">Other (specify below)</option>
              </select>
            </div>

            {documentType === "Other" && (
              <div className="space-y-1.5">
                <Label>Specify Document Type *</Label>
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g., Joint Venture Agreement"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Document Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., NDA between Acme Corp and Beta Ltd"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Parties Involved *</Label>
              <Textarea
                value={parties}
                onChange={(e) => setParties(e.target.value)}
                placeholder="e.g., Party A: Acme Corporation (a Delaware C-Corp). Party B: John Smith, freelance developer."
                rows={3}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Key Terms or Special Clauses</Label>
              <Textarea
                value={keyTerms}
                onChange={(e) => setKeyTerms(e.target.value)}
                placeholder="e.g., 2-year non-compete, $5,000/month retainer, IP assigned to client, 30-day termination notice"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Governing Jurisdiction</Label>
              <Input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="e.g., State of California, USA"
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
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting document…</> : <><Sparkles className="w-4 h-4" /> Generate Document</>}
            </Button>

            {!isPremium && (
              <p className="text-center text-xs text-muted-foreground">
                🔒 This feature requires the{" "}
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
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Generated Document</span>
              </div>
              <Button variant="outline" size="sm" onClick={copyResult} className="gap-1.5">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </Button>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground/90 max-h-[600px] overflow-y-auto">
                {result}
              </pre>
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground">
                ⚠️ This document is AI-assisted and intended as a starting point. Always have a qualified legal professional review any document before signing.
              </p>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Document Drafting"
        requiredPlan="premium"
      />
    </AppLayout>
  );
}
