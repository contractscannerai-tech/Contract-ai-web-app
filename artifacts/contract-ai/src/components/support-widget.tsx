import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { X, MessageCircle, Mail, ArrowLeft, Sparkles, Send, Loader2, Lock, Pencil, HelpCircle, Plus } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

const FAQ_ITEMS = [
  { q: "How do I upload a contract?", a: "Go to Upload from the sidebar. You can drag and drop a PDF or image — JPG, PNG, WebP, or PDF up to 10MB." },
  { q: "What plans are available?", a: "Starter (Free): 3 contracts. Pro ($29/mo): 50 contracts with full analysis. Legal Partner ($99/mo): 999 contracts + AI chat + every AI tool. Team ($399/mo): up to 5 members, each with full Legal Partner access." },
  { q: "How does AI analysis work?", a: "Our AI reads every clause, identifies risks, extracts key provisions, and explains everything in plain English. Depth varies by plan." },
  { q: "Is my data secure?", a: "Yes. Files are processed in memory only and never permanently stored. Raw text is deleted right after analysis." },
  { q: "How do I upgrade?", a: "Open Pricing from the sidebar and pick your plan. Payment is handled by our processor." },
  { q: "Can I delete my account?", a: "Yes. In Settings → Danger Zone. This permanently removes everything." },
];

type View = "menu" | "faq" | "faq-detail" | "ai" | "escalate" | "sent" | "memory";
type ChatMsg = { role: "user" | "assistant"; content: string };

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("ai");
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();

  const [selectedFaq, setSelectedFaq] = useState(0);
  const [escalateForm, setEscalateForm] = useState({ type: "technical", message: "" });
  const [sending, setSending] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [planLocked, setPlanLocked] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isPremium = user?.plan === "premium" || user?.plan === "team";

  // Allow other components (e.g. dashboard shortcut) to open this chat.
  useEffect(() => {
    const opener = () => { setOpen(true); setView("ai"); };
    window.addEventListener("contractai:open-chat", opener);
    return () => window.removeEventListener("contractai:open-chat", opener);
  }, []);

  useEffect(() => {
    if (open && view === "ai" && !chatLoaded && isPremium) {
      setChatLoaded(true);
      void (async () => {
        try {
          const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
          const res = await fetch(`${base}/api/support/chat/history`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setChatMessages(data.messages.map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content })));
          }
        } catch { /* ignore */ }
      })();
    }
  }, [open, view, chatLoaded, isPremium]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (view === "ai" && isPremium) inputRef.current?.focus();
    }
  }, [chatMessages, view, open, isPremium]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatSending(true);
    setPlanLocked(false);
    try {
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      const res = await fetch(`${base}/api/support/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.status === 402 || res.status === 403) {
        setPlanLocked(true);
        setChatMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok) throw new Error(data?.message ?? "Chat failed");
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "Sorry, no response." }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I'm having trouble right now. ${err instanceof Error ? err.message : ""}` }]);
    } finally {
      setChatSending(false);
    }
  }, [chatInput, chatSending]);

  function newChat() {
    setChatMessages([]);
    setChatInput("");
    setPlanLocked(false);
    inputRef.current?.focus();
  }

  // Floating launcher
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setView("ai"); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform group"
        aria-label="Open AI assistant"
        data-testid="support-widget-toggle"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
      </button>
    );
  }

  const headerTitle =
    view === "ai" ? "AI Assistant" :
    view === "faq" || view === "faq-detail" ? "Quick Help" :
    view === "escalate" ? "Contact Support" :
    view === "sent" ? "Submitted" :
    view === "memory" ? "Personalization" :
    "Help & Support";

  return (
    <div
      className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[400px] sm:max-h-[80vh] sm:h-[640px] bg-background sm:bg-card border-0 sm:border sm:border-card-border sm:rounded-2xl sm:shadow-2xl flex flex-col overflow-hidden"
      data-testid="support-widget-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          {view !== "ai" && view !== "menu" ? (
            <button onClick={() => setView(view === "faq-detail" ? "faq" : "menu")} className="p-1 hover:bg-muted rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : view === "ai" ? (
            <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
          ) : null}
          <h3 className="text-sm font-semibold truncate">{headerTitle}</h3>
        </div>
        <div className="flex items-center gap-1">
          {view === "ai" && isPremium && chatMessages.length > 0 && (
            <button
              onClick={newChat}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {view === "ai" && (
            <button
              onClick={() => setView("menu")}
              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              aria-label="Menu"
              title="Help menu"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-muted rounded" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "ai" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/30" data-testid="support-chat-messages">
            {!isPremium ? (
              <PlanLockedCard
                userPlan={user?.plan ?? "free"}
                onUpgrade={() => { setOpen(false); setLocation("/pricing"); }}
                onContact={() => setView("escalate")}
              />
            ) : chatMessages.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <p className="text-base font-semibold mb-1.5 text-foreground">
                  Hi{user?.displayName ? ` ${user.displayName}` : ""}! How can I help?
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  Ask me about contracts, plans, troubleshooting, or anything legal.
                </p>
                <div className="grid grid-cols-1 gap-2 text-left">
                  {[
                    "What does an indemnification clause mean?",
                    "How do I export my contract analysis as PDF?",
                    "Walk me through the negotiation tips feature.",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setChatInput(suggestion); inputRef.current?.focus(); }}
                      className="text-left px-3 py-2.5 text-xs bg-card border border-card-border rounded-lg hover:border-primary/40 hover:bg-card transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setView("memory")}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Pencil className="w-3 h-3" />
                  Personalize how the assistant remembers you
                </button>
              </div>
            ) : (
              chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-card-border text-foreground rounded-bl-md"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {chatSending && isPremium && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-card border border-card-border rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            {planLocked && (
              <PlanLockedCard
                userPlan={user?.plan ?? "free"}
                onUpgrade={() => { setOpen(false); setLocation("/pricing"); }}
                onContact={() => setView("escalate")}
              />
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-border bg-card">
            <div className="flex gap-2 items-end bg-muted/40 rounded-2xl px-3 py-2 border border-input focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                placeholder={isPremium ? "Message ContractAI…" : "Upgrade to chat with AI…"}
                disabled={chatSending || !isPremium}
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none resize-none max-h-32 disabled:opacity-50"
                data-testid="support-chat-input"
              />
              <button
                onClick={() => isPremium ? void sendChat() : (setOpen(false), setLocation("/pricing"))}
                disabled={(!chatInput.trim() && isPremium) || chatSending}
                className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-40 hover:opacity-90 flex-shrink-0"
                data-testid="support-chat-send"
                aria-label={isPremium ? "Send" : "Upgrade"}
              >
                {!isPremium ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {isPremium ? "AI may produce inaccurate info. Verify critical legal advice." : "AI Assistant is included with Legal Partner & Team plans."}
            </p>
          </div>
        </>
      ) : view === "menu" ? (
        <div className="flex-1 overflow-auto p-4 space-y-2">
          <button onClick={() => setView("ai")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-left">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="flex-1"><p className="text-sm font-medium">AI Assistant</p><p className="text-xs text-muted-foreground">Personal AI that remembers you</p></div>
          </button>
          <button onClick={() => setView("memory")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted text-left">
            <Pencil className="w-5 h-5 text-primary" />
            <div className="flex-1"><p className="text-sm font-medium">Personalization</p><p className="text-xs text-muted-foreground">Teach the assistant about you</p></div>
          </button>
          <button onClick={() => setView("faq")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted text-left">
            <MessageCircle className="w-5 h-5 text-primary" />
            <div className="flex-1"><p className="text-sm font-medium">Quick Help</p><p className="text-xs text-muted-foreground">FAQ — features, plans, how-to</p></div>
          </button>
          <button onClick={() => setView("escalate")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted text-left">
            <Mail className="w-5 h-5 text-destructive" />
            <div className="flex-1"><p className="text-sm font-medium">Contact Human Support</p><p className="text-xs text-muted-foreground">Account, billing, technical issues</p></div>
          </button>
        </div>
      ) : view === "memory" ? (
        <PersonalizationPanel onSaved={() => setView("ai")} />
      ) : view === "faq" ? (
        <div className="flex-1 overflow-auto p-3 space-y-1">
          {FAQ_ITEMS.map((item, i) => (
            <button key={i} onClick={() => { setSelectedFaq(i); setView("faq-detail"); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted text-sm text-foreground">
              {item.q}
            </button>
          ))}
        </div>
      ) : view === "faq-detail" ? (
        <div className="flex-1 overflow-auto p-4">
          <p className="text-sm font-semibold mb-3">{FAQ_ITEMS[selectedFaq]!.q}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{FAQ_ITEMS[selectedFaq]!.a}</p>
        </div>
      ) : view === "escalate" ? (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Issue type</label>
            <select value={escalateForm.type} onChange={(e) => setEscalateForm((f) => ({ ...f, type: e.target.value }))} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm">
              <option value="technical">Technical issue</option>
              <option value="subscription">Subscription problem</option>
              <option value="account">Account issue</option>
              <option value="billing">Billing question</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Describe your issue</label>
            <textarea value={escalateForm.message} onChange={(e) => setEscalateForm((f) => ({ ...f, message: e.target.value }))} rows={4} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none" placeholder="Tell us what happened..." />
          </div>
          <button
            onClick={async () => {
              if (!escalateForm.message.trim()) return;
              setSending(true);
              try {
                const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
                await fetch(`${base}/api/support/escalate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify(escalateForm),
                });
                setView("sent");
              } catch { setView("sent"); }
              finally { setSending(false); }
            }}
            disabled={!escalateForm.message.trim() || sending}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {sending ? "Sending..." : "Submit Support Request"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mb-3">✓</div>
          <p className="text-sm font-semibold mb-1">Request submitted</p>
          <p className="text-xs text-muted-foreground">Our support team will get back to you within 24 hours.</p>
        </div>
      )}
    </div>
  );
}

function PlanLockedCard({ userPlan, onUpgrade, onContact }: { userPlan: string; onUpgrade: () => void; onContact: () => void }) {
  return (
    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-amber-500/10 border border-primary/20 rounded-2xl p-5 text-center">
      <div className="w-12 h-12 mx-auto mb-3 bg-primary/15 rounded-2xl flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm font-semibold mb-1.5">Personal AI Assistant</p>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Chat with an AI that remembers you, your contracts, and your preferences. Available on the Legal Partner and Team plans.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Upgrade from {userPlan === "free" ? "Starter" : userPlan === "pro" ? "Pro" : userPlan}
        </button>
        <button
          onClick={onContact}
          className="px-4 py-2 bg-card border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors"
        >
          Contact human support instead
        </button>
      </div>
    </div>
  );
}

function PersonalizationPanel({ onSaved }: { onSaved: () => void }) {
  const { data: user, refetch } = useGetMe();
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");
  const [memory, setMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const u = user as { displayName?: string | null; profession?: string | null; chatPersonalization?: string | null } | undefined;
    if (u) {
      setDisplayName(u.displayName ?? "");
      setProfession(u.profession ?? "");
      setMemory(u.chatPersonalization ?? "");
    }
  }, [user]);

  async function save() {
    setSaving(true);
    try {
      const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
      await fetch(`${base}/api/auth/me/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          profession: profession.trim() || null,
          chatPersonalization: memory.trim() || null,
        }),
      });
      await refetch();
      setSavedNotice(true);
      setTimeout(() => { setSavedNotice(false); onSaved(); }, 800);
    } finally { setSaving(false); }
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Help the AI understand who you are. This is sent with every chat for more relevant answers.
      </p>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Your name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
          placeholder="What should I call you?"
          className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={60}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Your profession or role</label>
        <input
          type="text"
          value={profession}
          onChange={(e) => setProfession(e.target.value.slice(0, 80))}
          placeholder="e.g. Freelance designer, small business owner, software engineer"
          className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={80}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          What should the AI remember about you?
          <span className="text-muted-foreground/70 ml-1">({memory.length}/800)</span>
        </label>
        <textarea
          value={memory}
          onChange={(e) => setMemory(e.target.value.slice(0, 800))}
          rows={5}
          placeholder="e.g. I mostly review SaaS contracts. I dislike auto-renewals. I'm based in California. I'm not a lawyer so explain things simply."
          className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={800}
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {savedNotice ? "Saved ✓" : "Save personalization"}
      </button>
    </div>
  );
}
