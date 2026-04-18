import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Users, Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type Invite = { teamId: string; teamName: string; email: string; expiresAt: string };

export default function TeamJoinPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetMe();

  const params = new URLSearchParams(search);
  const token = params.get("token");

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token in the URL"); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/teams/invite/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Invite not found");
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load invite");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/teams/invite/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Could not accept");
      toast({ title: "Welcome to the team!", description: "You can now use shared scans." });
      setLocation("/team");
    } catch (err) {
      toast({ title: "Could not accept invite", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border px-4 sm:px-6 h-16 flex items-center">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">ContractAI</span>
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {loading || userLoading ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          ) : error ? (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <h1 className="text-xl font-bold mb-2">Invite unavailable</h1>
              <p className="text-sm text-muted-foreground mb-5">{error}</p>
              <Button onClick={() => setLocation("/")} variant="outline">Back to homepage</Button>
            </>
          ) : invite ? (
            <>
              <Users className="w-12 h-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-extrabold mb-1">You've been invited</h1>
              <p className="text-sm text-muted-foreground mb-2">to join</p>
              <p className="text-xl font-bold mb-5">{invite.teamName}</p>
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 mb-5">
                Sent to <span className="font-medium text-foreground">{invite.email}</span>.
                Expires {new Date(invite.expiresAt).toLocaleDateString()}.
              </div>

              {!user ? (
                <>
                  <p className="text-sm mb-3">Sign in with <span className="font-semibold">{invite.email}</span> to accept this invite.</p>
                  <Button onClick={() => setLocation(`/auth?next=/team/join?token=${token}`)} className="w-full">Sign in to accept</Button>
                </>
              ) : user.email.toLowerCase() !== invite.email.toLowerCase() ? (
                <>
                  <p className="text-sm text-destructive mb-3">
                    You're signed in as <span className="font-semibold">{user.email}</span>, but this invite was sent to <span className="font-semibold">{invite.email}</span>.
                  </p>
                  <Button onClick={() => setLocation(`/auth?next=/team/join?token=${token}`)} className="w-full" variant="outline">Switch account</Button>
                </>
              ) : (
                <Button onClick={accept} disabled={accepting} className="w-full" data-testid="accept-invite">
                  {accepting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Accepting...</> : <><CheckCircle className="w-4 h-4 mr-2" />Accept invite</>}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
