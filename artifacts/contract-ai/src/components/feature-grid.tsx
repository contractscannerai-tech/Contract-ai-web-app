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
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" /><path d="M7 8h4" /><path d="M7 16h4" />
    </svg>
  );
}

function PhotoScanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const CONTRACT_FEATURES: FeatureDef[] = [
  {
    id: "deep-analysis",
    label: "Contract Analysis",
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
    description: "Identify high-risk clauses instantly",
    icon: <ShieldIcon />,
    requiredPlan: "free",
    action: (nav) => nav("/contracts"),
  },
];

const AI_TOOL_FEATURES: FeatureDef[] = [
  {
    id: "draft-document",
    label: "Document Drafting",
    description: "AI assists in drafting professional legal documents",
    icon: <FileTextIcon />,
    requiredPlan: "premium",
    action: (nav) => nav("/ai/draft"),
  },
  {
    id: "ai-application",
    label: "Application Drafting",
    description: "AI assists in writing compelling job applications",
    icon: <SendIcon />,
    requiredPlan: "premium",
    action: (nav) => nav("/ai/application"),
  },
  {
    id: "resume-builder",
    label: "Resume Builder",
    description: "AI assists in building ATS-optimized resumes",
    icon: <UserIcon />,
    requiredPlan: "premium",
    action: (nav) => nav("/ai/resume"),
  },
  {
    id: "career-guidance",
    label: "Career Guidance",
    description: "AI assists with career paths and industry insights",
    icon: <TrendingUpIcon />,
    requiredPlan: "premium",
    action: (nav) => nav("/ai/career"),
  },
  {
    id: "templates",
    label: "Templates Library",
    description: "Professional document templates ready to draft",
    icon: <BookOpenIcon />,
    requiredPlan: "free",
    action: (nav) => nav("/ai/templates"),
  },
];

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

function FeatureCard({ feature, userPlan, onLock }: { feature: FeatureDef; userPlan: string; onLock: (f: FeatureDef) => void }) {
  const [, setLocation] = useLocation();
  const userRank = PLAN_RANK[userPlan] ?? 0;
  const reqRank = PLAN_RANK[feature.requiredPlan] ?? 0;
  const isLocked = userRank < reqRank;
  const isUnlocked = !isLocked;

  function handleClick() {
    if (isLocked) { onLock(feature); return; }
    if (feature.action) feature.action(setLocation);
  }

  return (
    <button
      onClick={handleClick}
      className={`relative group rounded-xl border p-4 text-left transition-all duration-200 w-full overflow-hidden
        ${isUnlocked
          ? "bg-card border-card-border hover:border-primary/40 hover:shadow-md cursor-pointer"
          : "bg-card/60 border-card-border/60 cursor-pointer"
        }`}
      data-testid={`feature-btn-${feature.id}`}
    >
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl backdrop-blur-[2px] bg-background/40 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <LockIcon />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {feature.requiredPlan === "pro" ? "Pro" : "Premium"}
          </span>
        </div>
      )}

      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-colors duration-200
        ${isUnlocked ? "bg-primary/10 text-primary group-hover:bg-primary/20" : "bg-muted/60 text-muted-foreground"}`}>
        {feature.icon}
      </div>

      <p className={`text-sm font-semibold mb-0.5 ${isLocked ? "text-muted-foreground/60" : "text-foreground"}`}>
        {feature.label}
        {isLocked && <span className="ml-1.5 inline-flex items-center text-muted-foreground/40"><LockIcon /></span>}
      </p>
      <p className={`text-xs leading-snug ${isLocked ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
        {feature.description}
      </p>
    </button>
  );
}

export function FeatureGrid({ userPlan }: FeatureGridProps) {
  const [modalFeature, setModalFeature] = useState<FeatureDef | null>(null);

  return (
    <>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contract Tools</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONTRACT_FEATURES.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} userPlan={userPlan} onLock={setModalFeature} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Tools</p>
          <p className="text-xs text-muted-foreground mb-3">
            {userPlan !== "premium"
              ? "🔒 AI Tools require the Legal Partner plan"
              : "✓ Full access — all AI tools unlocked"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AI_TOOL_FEATURES.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} userPlan={userPlan} onLock={setModalFeature} />
            ))}
          </div>
        </div>
      </div>

      {modalFeature && (
        <UpgradeModal
          open={!!modalFeature}
          onClose={() => setModalFeature(null)}
          feature={modalFeature.label}
          requiredPlan={modalFeature.requiredPlan === "free" ? "pro" : modalFeature.requiredPlan as "pro" | "premium"}
        />
      )}
    </>
  );
}
