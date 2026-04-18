import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  checkBiometricAvailability,
  verifyBiometric,
} from "@/lib/biometric-lock";

export function BiometricLockToggle() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(isBiometricLockEnabled());
    void (async () => {
      const r = await checkBiometricAvailability();
      setSupported(r.available);
      setReason(r.reason ?? "");
    })();
  }, []);

  // Hide the entire card on the web build — this only makes sense in the APK.
  if (!Capacitor.isNativePlatform()) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (!enabled) {
        if (!supported) {
          toast({ title: "Biometrics unavailable", description: reason || "Set up a fingerprint or face on your device first.", variant: "destructive" });
          return;
        }
        const ok = await verifyBiometric("Enable biometric login for ContractAI");
        if (!ok) {
          toast({ title: "Cancelled", description: "Biometric verification was cancelled." });
          return;
        }
        setBiometricLockEnabled(true);
        setEnabled(true);
        toast({ title: "Biometric login enabled", description: "You'll be asked to verify every time you open the app." });
      } else {
        const ok = await verifyBiometric("Disable biometric login");
        if (!ok) {
          toast({ title: "Cancelled", description: "Biometric verification was cancelled." });
          return;
        }
        setBiometricLockEnabled(false);
        setEnabled(false);
        toast({ title: "Biometric login disabled" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Lock className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold">Enable Biometric Login</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Require Fingerprint or Face ID every time you open ContractAI.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        role="switch"
        aria-checked={enabled}
        data-testid="biometric-lock-toggle"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted"} disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin absolute left-1/2 -translate-x-1/2 text-primary-foreground" />
        ) : (
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        )}
      </button>
    </div>
  );
}
