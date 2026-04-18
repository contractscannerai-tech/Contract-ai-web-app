import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Users, Mail, Trash2, Loader2, ArrowLeft, Crown, Copy, Check } from "lucide-react";
import AppLayout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type TeamData = {
  team: { id: string; name: string; ownerId: string; scansUsed: number; scansLimit: number; scansResetAt: string };
  role: "owner" | "member";
  members: { userId: string; role: string; email: string | null; joinedAt: string }[];
  pendingInvites: { id: string; email: string; expiresAt: string; createdAt: string; token?: string }[];
  maxMembers: number;
};

export default function TeamPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  async function handleLogout() {
    await logout.mutateAsync({});
    queryClient.clear();
    setLocation("/", { replace: true });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/teams/me", { credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? "Could not load team");
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/teams/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message ?? "Invite failed");
      toast({ title: "Invite sent!", description: `Invitation emailed to ${inviteEmail.trim()}` });
      setInviteEmail("");
      await load();
    } catch (err) {
      toast({ title: "Could not send invite", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string, email: string | null) {
    if (!confirm(`Remove ${email ?? "this member"} from the team?`)) return;
    try {
      const res = await fetch(`/api/teams/members/${userId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? "Remove failed");
      }
      toast({ title: "Member removed" });
      await load();
    } catch (err) {
      toast({ title: "Could not remove", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/team/join?token=${token}`;
    void navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  }

  return (
    <AppLayout
      user={user ? { email: user.email, plan: user.plan, contractsUsed: user.contractsUsed, contractsLimit: 0 } : null}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => setLocation("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" /> Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your shared scan pool and team members.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive" data-testid="team-error">
            {error}
            {error.toLowerCase().includes("team plan") && (
              <Button onClick={() => setLocation("/pricing")} className="mt-3 ml-2" size="sm">View Team plan</Button>
            )}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold">{data.team.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {data.role === "owner" ? "You are the team owner" : "You are a team member"} · {data.members.length} of {data.maxMembers} members
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold">{data.team.scansUsed}<span className="text-base font-normal text-muted-foreground">/{data.team.scansLimit}</span></p>
                  <p className="text-xs text-muted-foreground">shared scans this month</p>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${data.team.scansUsed / data.team.scansLimit > 0.8 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (data.team.scansUsed / data.team.scansLimit) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pool resets {new Date(data.team.scansResetAt).toLocaleDateString()}.
                Team plan excludes PDF export, contract comparison, and renegotiation suggestions.
              </p>
            </div>

            {data.role === "owner" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-base font-bold mb-1">Invite a member</h2>
                <p className="text-xs text-muted-foreground mb-4">Up to {data.maxMembers} members total. Invites expire in 7 days.</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviting || data.members.length + data.pendingInvites.length >= data.maxMembers}
                    data-testid="invite-email"
                  />
                  <Button
                    onClick={sendInvite}
                    disabled={inviting || data.members.length + data.pendingInvites.length >= data.maxMembers}
                    data-testid="invite-send"
                  >
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                    Send invite
                  </Button>
                </div>
                {data.members.length + data.pendingInvites.length >= data.maxMembers && (
                  <p className="text-xs text-amber-700 mt-2">Team is full. Remove a member or revoke a pending invite to add more.</p>
                )}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</div>
              {data.members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-6 py-3 border-b border-border last:border-0" data-testid={`member-${m.userId}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {(m.email ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.email ?? m.userId}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
                  </div>
                  {m.role === "owner" ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 font-semibold flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Owner
                    </span>
                  ) : data.role === "owner" ? (
                    <button
                      onClick={() => removeMember(m.userId, m.email)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                      data-testid={`remove-${m.userId}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {data.role === "owner" && data.pendingInvites.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-3 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending invites</div>
                {data.pendingInvites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-6 py-3 border-b border-border last:border-0">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => inv.token && copyInviteLink(inv.token)}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted"
                      data-testid={`copy-${inv.id}`}
                    >
                      {copiedToken === inv.id ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy link</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
