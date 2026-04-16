import { useState } from "react";
import { HelpCircle, X, MessageCircle, Mail, ChevronRight, ArrowLeft } from "lucide-react";

const FAQ_ITEMS = [
  { q: "How do I upload a contract?", a: "Go to the Upload page from the sidebar or dashboard. You can drag and drop a PDF or image file, or click to browse. We support PDF, JPG, PNG, and WebP files up to 10MB." },
  { q: "What file types are supported?", a: "We accept PDF documents and image files (JPG, PNG, WebP). Image files are processed using OCR to extract text. PDF is recommended for best results." },
  { q: "How does AI analysis work?", a: "Our AI reads every clause in your contract, identifies risks, extracts key provisions, and summarizes everything in plain language. The depth of analysis depends on your plan tier." },
  { q: "What are the plan differences?", a: "Starter (Free): 3 contracts with basic risk identification. Pro ($19/mo): 20 contracts with detailed explanations. Legal Partner ($49/mo): Unlimited contracts with renegotiation tips and AI chat." },
  { q: "Is my data secure?", a: "Yes. Uploaded files are processed in memory only and never permanently stored. Raw contract text is deleted immediately after AI analysis. We use bank-grade encryption." },
  { q: "How do I upgrade my plan?", a: "Go to the Pricing page from the sidebar and click the upgrade button for your desired plan. Payment is handled securely through our payment processor." },
  { q: "Can I delete my account?", a: "Yes. Go to Settings, scroll to the Danger Zone section, and follow the account deletion process. This permanently removes all your data." },
];

type View = "closed" | "menu" | "faq" | "faq-detail" | "escalate" | "sent";

export function SupportWidget() {
  const [view, setView] = useState<View>("closed");
  const [selectedFaq, setSelectedFaq] = useState(0);
  const [escalateForm, setEscalateForm] = useState({ type: "technical", message: "" });
  const [sending, setSending] = useState(false);

  if (view === "closed") {
    return (
      <button
        onClick={() => setView("menu")}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        data-testid="support-widget-toggle"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 max-h-[70vh] bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          {view !== "menu" && (
            <button onClick={() => setView("menu")} className="p-1 hover:bg-muted rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="text-sm font-semibold">Help & Support</h3>
        </div>
        <button onClick={() => setView("closed")} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {view === "menu" && (
          <div className="space-y-2">
            <button
              onClick={() => setView("faq")}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
            >
              <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Quick Help</p>
                <p className="text-xs text-muted-foreground">Navigation, features, how-to</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setView("escalate")}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
            >
              <Mail className="w-5 h-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Contact Support</p>
                <p className="text-xs text-muted-foreground">Account, subscription, technical issues</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {view === "faq" && (
          <div className="space-y-1">
            {FAQ_ITEMS.map((item, i) => (
              <button
                key={i}
                onClick={() => { setSelectedFaq(i); setView("faq-detail"); }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground"
              >
                {item.q}
              </button>
            ))}
          </div>
        )}

        {view === "faq-detail" && (
          <div>
            <p className="text-sm font-semibold mb-3">{FAQ_ITEMS[selectedFaq].q}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{FAQ_ITEMS[selectedFaq].a}</p>
          </div>
        )}

        {view === "escalate" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Issue type</label>
              <select
                value={escalateForm.type}
                onChange={(e) => setEscalateForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm"
              >
                <option value="technical">Technical issue</option>
                <option value="subscription">Subscription problem</option>
                <option value="account">Account issue</option>
                <option value="billing">Billing question</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Describe your issue</label>
              <textarea
                value={escalateForm.message}
                onChange={(e) => setEscalateForm((f) => ({ ...f, message: e.target.value }))}
                rows={4}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Tell us what happened..."
              />
            </div>
            <button
              onClick={async () => {
                if (!escalateForm.message.trim()) return;
                setSending(true);
                try {
                  await fetch("/api/support/escalate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(escalateForm),
                  });
                  setView("sent");
                } catch {
                  setView("sent");
                } finally {
                  setSending(false);
                }
              }}
              disabled={!escalateForm.message.trim() || sending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {sending ? "Sending..." : "Submit Support Request"}
            </button>
          </div>
        )}

        {view === "sent" && (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">{"\u2705"}</div>
            <p className="text-sm font-semibold mb-1">Request submitted</p>
            <p className="text-xs text-muted-foreground">Our support team will get back to you within 24 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
}
