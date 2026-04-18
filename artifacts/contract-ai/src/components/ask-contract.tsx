import { useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

type AskAnswer = {
  answer: string;
  questionsUsedToday: number;
  dailyLimit: number | null;
};

export function AskContract({ contractId, plan }: { contractId: string; plan: string }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number | null } | null>(null);

  async function handleAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/${contractId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: q, language: lang }),
      });
      const body = await res.json() as AskAnswer & { message?: string };
      if (!res.ok) throw new Error(body.message ?? `Failed (${res.status})`);
      setHistory((h) => [...h, { q, a: body.answer }]);
      setQuestion("");
      setUsage({ used: body.questionsUsedToday, limit: body.dailyLimit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Could not get answer", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const limitText = usage
    ? usage.limit === null
      ? `${usage.used} asked today · unlimited`
      : `${usage.used}/${usage.limit} asked today`
    : plan === "free" ? "3 questions/day on Free"
    : plan === "pro" ? "20 questions/day on Pro"
    : "unlimited questions";

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="ask-contract">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Ask Your Contract
        </h2>
        <span className="text-xs text-muted-foreground">{limitText}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ask anything about this contract. Answers are based only on the document text.
      </p>

      {history.length > 0 && (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
          {history.map((h, i) => (
            <div key={i} className="space-y-1.5" data-testid={`ask-item-${i}`}>
              <div className="bg-primary/10 text-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-sm ml-8">
                <p className="font-medium text-xs text-primary mb-0.5">You asked</p>
                {h.q}
              </div>
              <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-3 py-2 text-sm mr-8">
                <p className="font-medium text-xs text-muted-foreground mb-0.5">ContractAI</p>
                {h.a}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAsk(); } }}
          placeholder="e.g. What happens if I terminate early?"
          rows={1}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30"
          disabled={loading}
          data-testid="ask-input"
        />
        <Button onClick={() => void handleAsk()} disabled={!question.trim() || loading} size="sm" data-testid="ask-submit">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
