import { useState } from "react";
import { useLocation } from "wouter";
import { UpgradeModal } from "./upgrade-modal";

interface FeatureDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiredPlan: "free" | "pro" | "premium";
  action?: (setLocation: (path: string) => void) => void;
}

interface FeatureGridProps {
  userPlan: "free" | "pro" | "premium";
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" /><path d="M7 8h4" /><path d="M7 16h4" />
    </svg>
  );
}

function PhotoScanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v16" /><path d="M19 3v16" />
      <path d="M3 7h4" /><path d="M17 7h4" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

function NegotiateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

const FEATURES: FeatureDef[] = [
  {
    id: "deep-analysis",
    label: "Deep Analysis",
    description: "AI-powered full contract review",
    icon: <ScanIcon />,
    requiredPlan: "free",
    action: (nav) => nav("/contracts/upload"),
  },
  {
    id: "photo-scan",
    label: "Photo Scan",
    description: "Upload contract photos via OCR",
    icon: <PhotoScanIcon />,
    requiredPlan: "pro",
    action: (nav) => nav("/contracts/upload"),
  },
  {
    id: "risk-alerts",
    label: "Risk Alerts",
    description: "Identify high-risk clauses",
    icon: <ShieldIcon />,
    requiredPlan: "free",
    action: (nav) => nav("/contracts"),
  },
  {
    id: "key-dates",
    label: "Key Dates",
    description: "Extract deadlines & renewals",
    icon: <CalendarIcon />,
    requiredPlan: "pro",
    action: (nav) => nav("/contracts"),
  },
  {
    id: "version-compare",
    label: "Version Compare",
    description: "Track changes between drafts",
    icon: <CompareIcon />,
    requiredPlan: "premium",
  },
  {
    id: "negotiation-helper",
    label: "Negotiation Helper",
    description: "AI renegotiation recommendations",
    icon: <NegotiateIcon />,
    requiredPlan: "premium",
    action: (nav) => nav("/contracts"),
  },
];

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

export function FeatureGrid({ userPlan }: FeatureGridProps) {
  const [, setLocation] = useLocation();
  const [modalFeature, setModalFeature] = useState<FeatureDef | null>(null);

  function handleClick(feature: FeatureDef) {
    const userRank = PLAN_RANK[userPlan] ?? 0;
    const reqRank = PLAN_RANK[feature.requiredPlan] ?? 0;
    if (userRank < reqRank) {
      setModalFeature(feature);
      return;
    }
    if (feature.action) feature.action(setLocation);
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FEATURES.map((feature) => {
          const userRank = PLAN_RANK[userPlan] ?? 0;
          const reqRank = PLAN_RANK[feature.requiredPlan] ?? 0;
          const isLocked = userRank < reqRank;
          const isUnlocked = !isLocked;

          return (
            <button
              key={feature.id}
              onClick={() => handleClick(feature)}
              className={`relative group rounded-xl border p-4 text-left transition-all duration-300 overflow-hidden
                ${isUnlocked
                  ? "bg-card border-card-border hover:border-primary/40 hover:shadow-md cursor-pointer feature-unlocked"
                  : "bg-card/60 border-card-border/60 cursor-pointer"
                }`}
              data-testid={`feature-btn-${feature.id}`}
            >
              {/* Shimmer on unlocked hover */}
              {isUnlocked && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none feature-shimmer" />
              )}

              {/* Glass lock overlay */}
              {isLocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl backdrop-blur-[2px] bg-background/40 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {feature.requiredPlan === "pro" ? "Pro" : "Legal Partner"}
                  </span>
                </div>
              )}

              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-colors duration-300
                ${isUnlocked ? "bg-primary/10 text-primary group-hover:bg-primary/20" : "bg-muted/60 text-muted-foreground"}`}>
                {feature.icon}
              </div>

              <p className={`text-sm font-semibold mb-0.5 ${isLocked ? "text-muted-foreground/60" : "text-foreground"}`}>
                {feature.label}
              </p>
              <p className={`text-xs leading-snug ${isLocked ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                {feature.description}
              </p>

              {isLocked && (
                <span className="absolute top-3 right-3 text-muted-foreground/40">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {modalFeature && (
        <UpgradeModal
          open={!!modalFeature}
          onClose={() => setModalFeature(null)}
          feature={modalFeature.label}
          requiredPlan={modalFeature.requiredPlan as "pro" | "premium"}
        />
      )}
    </>
  );
}
