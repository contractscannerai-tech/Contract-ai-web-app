import { useState } from "react";
import { Shield, FileText } from "lucide-react";

const PRIVACY_URL = "https://contractscannerai-tech.github.io/Contractai-privacy-policy/";

interface UserAgreementPopupProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function UserAgreementPopup({ onAccept, onDecline }: UserAgreementPopupProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAgree() {
    if (!checked) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to save agreement");
      onAccept();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">User Agreement</h2>
          <p className="text-sm text-muted-foreground">
            Please review and accept our terms to continue using ContractAI.
          </p>
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6 text-sm text-muted-foreground space-y-2">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Your data is processed securely and never sold to third parties.</span>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>Uploaded documents are processed in memory and deleted after analysis.</span>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>AI-generated analysis is for informational purposes only, not legal advice.</span>
          </div>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 w-4 h-4 accent-primary rounded"
            data-testid="checkbox-agree-terms"
          />
          <span className="text-sm text-foreground leading-relaxed">
            I have read and agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              Privacy Policy
            </a>.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAgree}
            disabled={!checked || submitting}
            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-agree-continue"
          >
            {submitting ? "Saving..." : "Agree and Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
