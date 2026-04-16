import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Crown, X, Zap, Lock } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  requiredPlan: "pro" | "premium";
}

const PLAN_DETAILS = {
  pro: {
    name: "Pro",
    icon: <Zap className="w-5 h-5" />,
    price: "$29/month",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    perks: [
      "20 contracts/month (PDF + Photo)",
      "Full risk explanations in plain English",
      "Image scanning with OCR",
      "Contract history & archive",
    ],
  },
  premium: {
    name: "Legal Partner",
    icon: <Crown className="w-5 h-5" />,
    price: "$99/month",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    perks: [
      "Unlimited contracts (PDF + Photo)",
      "Renegotiation recommendations per clause",
      "AI chat — unlimited questions",
      "Document Drafting, Resume Builder, Career Guidance",
      "Full Document Templates Library",
    ],
  },
};

export function UpgradeModal({ open, onClose, feature, requiredPlan }: UpgradeModalProps) {
  const [, setLocation] = useLocation();
  const plan = PLAN_DETAILS[requiredPlan];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm bg-card/95 backdrop-blur-xl border border-card-border rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="upgrade-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-modal-close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock icon */}
        <div className={`w-14 h-14 ${plan.bg} rounded-2xl flex items-center justify-center mx-auto mb-5`}>
          <Lock className={`w-7 h-7 ${plan.color}`} />
        </div>

        <h2 className="text-xl font-bold text-center mb-1">{feature}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          This feature requires the <strong className={plan.color}>{plan.name}</strong> plan.
        </p>

        {/* Plan card */}
        <div className={`${plan.bg} ${plan.border} border rounded-xl p-4 mb-5`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 bg-card rounded-lg flex items-center justify-center ${plan.color}`}>
              {plan.icon}
            </div>
            <div>
              <p className={`font-bold text-sm ${plan.color}`}>{plan.name}</p>
              <p className="text-xs text-muted-foreground">{plan.price}</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {plan.perks.map((perk, i) => (
              <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                <span className={`${plan.color} font-bold mt-0.5`}>✓</span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <Button
          className="w-full gap-2"
          onClick={() => { onClose(); setLocation("/pricing"); }}
          data-testid="button-modal-upgrade"
        >
          {plan.icon}
          Upgrade to {plan.name}
        </Button>
        <Button variant="ghost" className="w-full mt-2" size="sm" onClick={onClose}>
          Maybe later
        </Button>
      </div>
    </div>
  );
}
