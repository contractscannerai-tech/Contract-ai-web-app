import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle, FileText, ChevronLeft, Loader2,
  Shield, Send, BookOpen, AlertCircle, RefreshCw, MessageSquare, Crown,
} from "lucide-react";
import {
  useGetContract, useAnalyzeContract, useGetMe, useLogout,
  useChatWithContract, useGetChatHistory,
  getGetContractQueryKey, getGetChatHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import AppLayout from "@/components/layout";
import { RiskSpeedometer } from "@/components/risk-speedometer";

function extractErrorMessage(err: unknown): string {
  if (!err) return "The request could not be completed. Please refresh the page and try again.";
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e["message"] === "string") return e["message"];
  }
  return String(err);
}

type Analysis = {
  summary: string;
  risks: string[];
  keyClauses: string[];
  renegotiation?: string[] | null;
  riskLevel: "low" | "medium" | "high";
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: contractData, isLoading } = useGetContract(id, {
    query: { queryKey: getGetContractQueryKey(id) },
  });

  const { data: user } = useGetMe();
  const logout = useLogout();
  const analyzeContract = useAnalyzeContract();
  const chatMutation = useChatWithContract();
  const isPremium = user?.plan === "premium";

  const { data: chatHistory } = useGetChatHistory(id, {
    query: {
      queryKey: getGetChatHistoryQueryKey(id),
      enabled: isPremium,
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatMutation.isPending]);

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/");
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      await analyzeContract.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetContractQueryKey(id) });
      toast({ title: "Analysis complete!", description: "Your contract report is ready." });
    } catch (err) {
      toast({ title: "Analysis failed", description: extractErrorMessage(err), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSendMessage() {
    if (!chatMessage.trim() || chatMutation.isPending) return;
    const msg = chatMessage.trim();
    setChatMessage("");
    try {
      await chatMutation.mutateAsync({ contractId: id, data: { message: msg } });
      queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
    } catch (err) {
      toast({ title: "Chat error", description: extractErrorMessage(err), variant: "destructive" });
      setChatMessage(msg);
    }
  }

  const analysis = contractData?.analysis as Analysis | undefined;
  const renegotiation = analysis?.renegotiation;

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      {/* Extra bottom padding to make room for the sticky chat bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-32">

        <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} className="mb-6 gap-2 transition-all duration-300" data-testid="button-back">
          <ChevronLeft className="w-4 h-4" /> Back to contracts
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : !contractData ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Contract not found.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Header card */}
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold tracking-tight truncate">{contractData.filename}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Uploaded {formatDate(contractData.createdAt)}
                    {contractData.analyzedAt && ` · Analyzed ${formatDate(contractData.analyzedAt)}`}
                  </p>
                </div>
              </div>

              {!analysis && contractData.status !== "analyzing" && contractData.status !== "extracting" && (
                <div className="mt-5 pt-5 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    {contractData.status === "failed"
                      ? "Text extraction failed. The file may be password-protected or corrupted."
                      : "This contract hasn't been analyzed yet."}
                  </p>
                  {contractData.status !== "failed" && (
                    <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2 transition-all duration-300" data-testid="button-analyze">
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {analyzing ? "Analyzing…" : "Analyze with AI"}
                    </Button>
                  )}
                </div>
              )}

              {(contractData.status === "analyzing" || contractData.status === "extracting") && !analysis && (
                <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {contractData.status === "extracting" ? "Extracting text…" : "Analyzing with AI…"}
                  </p>
                </div>
              )}
            </div>

            {analysis && (
              <>
                {/* Risk Speedometer — prominent top section */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6" data-testid="section-speedometer">
                  <div className="flex-shrink-0">
                    <RiskSpeedometer riskLevel={analysis.riskLevel} />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="font-bold text-lg mb-2">Risk Assessment</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {analysis.riskLevel === "high"
                        ? "This contract contains multiple high-severity clauses that require immediate attention before signing. Review all flagged risks carefully."
                        : analysis.riskLevel === "medium"
                        ? "This contract has notable risks worth addressing. Review the flagged clauses and consider requesting amendments."
                        : "This contract presents a relatively low risk profile. Still review the key clauses to ensure they meet your needs."}
                    </p>
                    <div className="flex items-center gap-4 mt-4 justify-center sm:justify-start">
                      <div className="text-center">
                        <p className="text-2xl font-bold tabular-nums">{analysis.risks.length}</p>
                        <p className="text-xs text-muted-foreground">Risk alerts</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center">
                        <p className="text-2xl font-bold tabular-nums">{analysis.keyClauses.length}</p>
                        <p className="text-xs text-muted-foreground">Key clauses</p>
                      </div>
                      {renegotiation && renegotiation.length > 0 && (
                        <>
                          <div className="w-px h-8 bg-border" />
                          <div className="text-center">
                            <p className="text-2xl font-bold tabular-nums">{renegotiation.length}</p>
                            <p className="text-xs text-muted-foreground">Renegotiation tips</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm transition-all duration-300" data-testid="section-summary">
                  <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Summary
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Risk Alerts */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="section-risks">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      Risk Alerts ({analysis.risks.length})
                    </h2>
                    {user?.plan === "free" && (
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                        Names only — upgrade for full explanations
                      </span>
                    )}
                  </div>
                  {analysis.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No significant risks detected.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {analysis.risks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-3 bg-destructive/5 border border-destructive/10 rounded-lg p-3.5 transition-all duration-300 hover:bg-destructive/8" data-testid={`risk-item-${i}`}>
                          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed">{risk}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {user?.plan === "free" && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Pro & Legal Partner plans include full risk explanations with legal context.</p>
                      <Button variant="outline" size="sm" onClick={() => setLocation("/pricing")}>Upgrade</Button>
                    </div>
                  )}
                </div>

                {/* Key Clauses */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="section-clauses">
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Key Clauses ({analysis.keyClauses.length})
                  </h2>
                  {analysis.keyClauses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No key clauses extracted.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {analysis.keyClauses.map((clause, i) => (
                        <div key={i} className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-lg p-3.5 transition-all duration-300 hover:bg-primary/8" data-testid={`clause-item-${i}`}>
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed">{clause}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Renegotiation — Premium */}
                {isPremium && renegotiation && renegotiation.length > 0 && (
                  <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="section-renegotiation">
                    <h2 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      Renegotiation Recommendations ({renegotiation.length})
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">Specific changes to request before signing.</p>
                    <div className="space-y-2.5">
                      {renegotiation.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/10 rounded-lg p-3.5 transition-all duration-300" data-testid={`renegotiation-item-${i}`}>
                          <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Renegotiation upsell for non-premium */}
                {!isPremium && (
                  <div className="bg-card border border-card-border rounded-xl p-6 text-center" data-testid="section-renegotiation-upsell">
                    <RefreshCw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">Renegotiation Recommendations</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get clause-level suggestions for what to request before signing — Legal Partner plan.
                    </p>
                    <Button onClick={() => setLocation("/pricing")} data-testid="button-upgrade-renegotiation">
                      Upgrade to Legal Partner
                    </Button>
                  </div>
                )}

                {/* Chat history — visible above the sticky bar for premium */}
                {isPremium && chatHistory && chatHistory.length > 0 && (
                  <div className="bg-card border border-card-border rounded-xl overflow-hidden" data-testid="section-chat-history">
                    <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <h2 className="font-semibold text-base">AI Chat History</h2>
                    </div>
                    <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                      {chatHistory.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${msg.id}`}>
                          <div className={`max-w-xs sm:max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-2xl px-4 py-2.5">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        )}
      </div>

      {/* Persistent sticky chat bar — always at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:left-56">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4 pt-2">
          {isPremium ? (
            <div className="bg-card/95 backdrop-blur-xl border border-card-border rounded-2xl shadow-2xl flex items-end gap-3 px-4 py-3" data-testid="sticky-chat-bar">
              <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mb-0.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
              </div>
              <textarea
                value={chatMessage}
                onChange={(e) => {
                  setChatMessage(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder="Ask anything about this contract…"
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed py-1"
                disabled={chatMutation.isPending || !analysis}
                data-testid="input-chat"
                style={{ minHeight: "28px", maxHeight: "120px", overflowY: "auto" }}
              />
              <Button
                size="sm"
                onClick={() => void handleSendMessage()}
                disabled={!chatMessage.trim() || chatMutation.isPending || !analysis}
                className="flex-shrink-0 rounded-xl h-9 w-9 p-0 transition-all duration-300"
                data-testid="button-send-chat"
              >
                {chatMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setLocation("/pricing")}
              className="w-full bg-card/90 backdrop-blur-xl border border-card-border rounded-2xl shadow-xl flex items-center gap-3 px-4 py-3 hover:bg-card transition-all duration-300 group"
              data-testid="sticky-chat-upsell"
            >
              <div className="w-7 h-7 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <Crown className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground flex-1 text-left">
                Upgrade to Legal Partner to chat with this contract…
              </p>
              <span className="text-xs text-primary font-medium group-hover:underline underline-offset-2 flex-shrink-0">
                Upgrade →
              </span>
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
