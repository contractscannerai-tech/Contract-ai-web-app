import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle, FileText, ChevronLeft, Loader2,
  MessageSquare, Shield, Send, BookOpen, AlertCircle
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

const riskConfig = {
  high: { label: "High Risk", className: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertTriangle className="w-4 h-4" /> },
  medium: { label: "Medium Risk", className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", icon: <AlertCircle className="w-4 h-4" /> },
  low: { label: "Low Risk", className: "bg-green-500/10 text-green-700 border-green-500/20", icon: <CheckCircle className="w-4 h-4" /> },
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const { data: contractData, isLoading } = useGetContract(id, {
    query: { queryKey: getGetContractQueryKey(id) },
  });

  const { data: user } = useGetMe();
  const logout = useLogout();
  const analyzeContract = useAnalyzeContract();
  const chatMutation = useChatWithContract();
  const { data: chatHistory } = useGetChatHistory(id, {
    query: {
      queryKey: getGetChatHistoryQueryKey(id),
      enabled: user?.plan === "premium",
    },
  });

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
      toast({ title: "Analysis complete!", description: "Your contract has been analyzed." });
    } catch (err) {
      toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSendMessage() {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage("");
    try {
      await chatMutation.mutateAsync({ contractId: id, data: { message: msg } });
      queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
    } catch (err) {
      toast({ title: "Chat error", description: "Could not send message. Please try again.", variant: "destructive" });
      setChatMessage(msg);
    }
  }

  const analysis = contractData?.analysis;
  const risk = analysis ? riskConfig[analysis.riskLevel] ?? riskConfig.low : null;

  return (
    <AppLayout user={user} onLogout={handleLogout}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} className="mb-6 gap-2" data-testid="button-back">
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
            {/* Header */}
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">{contractData.filename}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Uploaded {formatDate(contractData.createdAt)}
                      {contractData.analyzedAt && ` · Analyzed ${formatDate(contractData.analyzedAt)}`}
                    </p>
                  </div>
                </div>
                {risk && (
                  <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${risk.className}`} data-testid="badge-risk-level">
                    {risk.icon}
                    {risk.label}
                  </div>
                )}
              </div>

              {!analysis && contractData.status !== "analyzing" && contractData.status !== "extracting" && (
                <div className="mt-5 pt-5 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-4">This contract hasn't been analyzed yet.</p>
                  <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2" data-testid="button-analyze">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {analyzing ? "Analyzing..." : "Analyze with AI"}
                  </Button>
                </div>
              )}

              {(contractData.status === "analyzing" || contractData.status === "extracting") && !analysis && (
                <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {contractData.status === "extracting" ? "Extracting text from PDF..." : "Analyzing with AI..."}
                  </p>
                </div>
              )}
            </div>

            {analysis && (
              <>
                {/* Summary */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="section-summary">
                  <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Summary
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Risks */}
                <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm" data-testid="section-risks">
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Risks ({analysis.risks.length})
                  </h2>
                  {analysis.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No significant risks detected.</p>
                  ) : (
                    <div className="space-y-3">
                      {analysis.risks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-3 bg-destructive/5 border border-destructive/10 rounded-lg p-3" data-testid={`risk-item-${i}`}>
                          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-sm">{risk}</p>
                        </div>
                      ))}
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
                    <div className="space-y-3">
                      {analysis.keyClauses.map((clause, i) => (
                        <div key={i} className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-lg p-3" data-testid={`clause-item-${i}`}>
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm">{clause}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Chat */}
                {user?.plan === "premium" ? (
                  <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden" data-testid="section-chat">
                    <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <h2 className="font-semibold text-base">Ask AI about this contract</h2>
                    </div>

                    <div className="h-64 overflow-y-auto p-4 space-y-3">
                      {(!chatHistory || chatHistory.length === 0) ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-muted-foreground text-center">Ask anything about this contract — risks, clauses, obligations, or what specific terms mean.</p>
                        </div>
                      ) : (
                        chatHistory.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            data-testid={`chat-msg-${msg.id}`}
                          >
                            <div className={`max-w-xs sm:max-w-sm rounded-xl px-4 py-2.5 text-sm ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}>
                              {msg.content}
                            </div>
                          </div>
                        ))
                      )}
                      {chatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-xl px-4 py-2.5">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t border-border flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Ask about this contract..."
                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        disabled={chatMutation.isPending}
                        data-testid="input-chat"
                      />
                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim() || chatMutation.isPending}
                        data-testid="button-send-chat"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-card border border-card-border rounded-xl p-6 text-center" data-testid="section-chat-upsell">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">AI Chat is a Premium feature</h3>
                    <p className="text-sm text-muted-foreground mb-4">Ask AI anything about your contract — what specific clauses mean, hidden obligations, negotiation points.</p>
                    <Button onClick={() => setLocation("/pricing")} data-testid="button-upgrade-chat">
                      Upgrade to Premium
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
