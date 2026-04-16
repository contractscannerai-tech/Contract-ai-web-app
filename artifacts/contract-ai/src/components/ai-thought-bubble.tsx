import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const TIPS = [
  "Don't forget to check the termination clause — it often hides early exit penalties.",
  "Auto-renewal clauses can lock you in for another full year. Always look for opt-out windows.",
  "IP ownership in contractor agreements often defaults to the hiring company. Verify you retain your work.",
  "Liability caps matter — without them, your financial exposure is unlimited.",
  "Non-compete clauses vary by jurisdiction. Some states won't enforce them at all.",
  "Jurisdiction clauses determine where disputes are settled. A far-away court can be a negotiating tactic.",
  "Indemnification clauses can make you responsible for the other party's legal costs.",
  "Confidentiality agreements with no time limit may be unenforceable. Request a defined end date.",
  "Payment terms of 'Net-90' mean you wait 3 months to get paid. Negotiate for Net-30.",
  "Change-of-control provisions may void your contract if the company is acquired.",
  "Force majeure clauses became critical after COVID-19. Make sure yours covers pandemics.",
  "Liquidated damages clauses set a fixed penalty amount — review if it's proportionate.",
  "Unilateral amendment rights let one party change the contract without your approval. Flag these.",
  "Governing law clauses can matter more than jurisdiction — some laws favor one side heavily.",
  "Always check whether your contract has a 'work-for-hire' clause before signing.",
];

export function AiThoughtBubble() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TIPS.length);
        setVisible(true);
      }, 500);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="relative flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 overflow-hidden"
      data-testid="ai-thought-bubble"
    >
      {/* Subtle shimmer background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div className="ai-bubble-shimmer" />
      </div>

      <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider mb-1">AI Insight</p>
        <p
          className="text-sm text-foreground/80 leading-relaxed"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          {TIPS[idx]}
        </p>
      </div>
    </div>
  );
}
