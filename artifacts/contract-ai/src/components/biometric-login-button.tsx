import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function BiometricLoginButton({ email, onSuccess }: { email: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  if (!supported) return null;

  async function attempt() {
    if (!email.trim()) {
      toast({ title: "Enter your email first", description: "We need to know which account to sign you into.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const optsRes = await fetch("/api/biometric/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!optsRes.ok) {
        const data = await optsRes.json().catch(() => ({}));
        throw new Error(data?.message ?? "Could not start biometric login");
      }
      const options = await optsRes.json();
      if (!options.allowCredentials || options.allowCredentials.length === 0) {
        toast({ title: "No biometric devices found", description: "This account hasn't enabled biometric login. Sign in with your password and enroll a device in Settings.", variant: "destructive" });
        return;
      }

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/biometric/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), response: authResp }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        throw new Error(data?.message ?? "Biometric verification failed");
      }
      const data = await verifyRes.json();

      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) throw new Error(setErr.message);

      toast({ title: "Welcome back!", description: "Signed in with biometrics." });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("AbortError") || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("not allowed")) {
        toast({ title: "Cancelled", description: "Biometric sign-in was cancelled." });
      } else {
        toast({ title: "Biometric sign-in failed", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={attempt}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-input bg-background hover:bg-muted text-sm font-medium transition-colors disabled:opacity-50"
      data-testid="biometric-login-button"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
      Sign in with biometrics
    </button>
  );
}
