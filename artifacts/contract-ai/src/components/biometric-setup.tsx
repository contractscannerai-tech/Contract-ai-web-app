import { useEffect, useState, useCallback } from "react";
import { Fingerprint, Trash2, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startRegistration } from "@simplewebauthn/browser";
import { useToast } from "@/hooks/use-toast";

type Cred = { id: string; deviceLabel: string | null; createdAt: string; lastUsedAt: string | null };

export function BiometricSetup() {
  const { toast } = useToast();
  const [creds, setCreds] = useState<Cred[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/credentials", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load credentials");
      const data = await res.json();
      setCreds(data.credentials ?? []);
    } catch (err) {
      toast({ title: "Could not load biometric devices", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function enroll() {
    setRegistering(true);
    try {
      const optsRes = await fetch("/api/biometric/register/options", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!optsRes.ok) {
        const data = await optsRes.json().catch(() => ({}));
        throw new Error(data?.message ?? "Could not start enrollment");
      }
      const options = await optsRes.json();

      const attResp = await startRegistration({ optionsJSON: options });

      const deviceLabel = navigator.userAgent.match(/(iPhone|iPad|Android|Mac|Windows|Linux)/)?.[0] ?? "Device";

      const verifyRes = await fetch("/api/biometric/register/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceLabel }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        throw new Error(data?.message ?? "Verification failed");
      }
      toast({ title: "Biometric login enabled", description: "You can now sign in with your fingerprint or Face ID." });
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("AbortError") || msg.includes("cancel") || msg.toLowerCase().includes("not allowed")) {
        toast({ title: "Cancelled", description: "Biometric setup was cancelled." });
      } else {
        toast({ title: "Enrollment failed", description: msg, variant: "destructive" });
      }
    } finally {
      setRegistering(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this device? You'll need to re-enroll to use biometric login again.")) return;
    try {
      const res = await fetch(`/api/biometric/credentials/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Device removed" });
      await refresh();
    } catch (err) {
      toast({ title: "Could not remove device", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Biometric login not supported</p>
          <p className="text-xs text-muted-foreground">Your browser doesn't support WebAuthn. Use a modern browser on a device with Touch ID, Face ID, or Windows Hello.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Fingerprint className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Biometric login</h3>
          <p className="text-xs text-muted-foreground">Sign in with Face ID, Touch ID, or Windows Hello</p>
        </div>
        <Button size="sm" onClick={enroll} disabled={registering} data-testid="biometric-enroll">
          {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Add device
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : creds.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No devices enrolled yet.</p>
      ) : (
        <div className="space-y-2">
          {creds.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border" data-testid={`biometric-cred-${c.id}`}>
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.deviceLabel ?? "Device"}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(c.createdAt).toLocaleDateString()}
                  {c.lastUsedAt ? ` · Last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" data-testid={`biometric-remove-${c.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
