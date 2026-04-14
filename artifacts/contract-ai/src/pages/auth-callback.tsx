import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          throw new Error(error?.message ?? "No session found after OAuth redirect");
        }

        const accessToken = data.session.access_token;

        const res = await fetch(`${BASE}/api/auth/oauth-session`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `Server returned ${res.status}`);
        }

        if (!cancelled) {
          toast({ title: "Logged in!", description: "Welcome to ContractAI." });
          setLocation("/dashboard");
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Google login failed. Please try again or use email/password login.";
          setErrorMsg(msg);
          setStatus("error");
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        }
      }
    }

    void handleCallback();
    return () => { cancelled = true; };
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="font-bold tracking-tight text-lg">ContractAI</span>
      </div>

      {status === "loading" ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Completing login…</p>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive font-medium">{errorMsg}</p>
          <button
            onClick={() => setLocation("/auth")}
            className="text-sm text-primary underline underline-offset-2"
          >
            Back to login
          </button>
        </div>
      )}
    </div>
  );
}
