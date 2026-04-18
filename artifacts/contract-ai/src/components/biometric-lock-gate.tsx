import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Fingerprint, Loader2 } from "lucide-react";
import { isBiometricLockEnabled, verifyBiometric } from "@/lib/biometric-lock";

// Shows a full-screen lock that requires successful biometric verification
// before revealing the app content. Behaves like WhatsApp's app lock.
// On non-native (browser) builds it always renders children directly.
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => !Capacitor.isNativePlatform() || !isBiometricLockEnabled());
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  const tryUnlock = useCallback(async () => {
    setVerifying(true);
    setFailed(false);
    const ok = await verifyBiometric("Unlock ContractAI");
    setVerifying(false);
    if (ok) setUnlocked(true);
    else setFailed(true);
  }, []);

  useEffect(() => {
    if (!unlocked) void tryUnlock();
    // Re-prompt when the app comes back from background.
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", (state) => {
          if (state.isActive && isBiometricLockEnabled()) {
            setUnlocked(false);
          }
        });
        if (cancelled) handle.remove();
        else cleanup = () => handle.remove();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9998] bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
        <Fingerprint className="w-10 h-10" />
      </div>
      <h2 className="text-xl font-bold mb-2">ContractAI is locked</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        Use your fingerprint or face to unlock the app.
      </p>
      <button
        onClick={tryUnlock}
        disabled={verifying}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
        data-testid="biometric-unlock"
      >
        {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
        {verifying ? "Verifying..." : failed ? "Try again" : "Unlock"}
      </button>
      {failed && (
        <p className="text-xs text-destructive mt-4">Verification cancelled. Tap Try again.</p>
      )}
    </div>
  );
}
