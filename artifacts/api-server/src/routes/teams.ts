import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { db, usersTable, teamsTable, teamMembersTable, teamInvitesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const MAX_MEMBERS = 5;
const MONTHLY_SCANS_LIMIT = 50;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

async function ensureTeamForOwner(ownerId: string, ownerEmail: string): Promise<string> {
  const existing = await db.select().from(teamsTable).where(eq(teamsTable.ownerId, ownerId)).limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  const teamId = uuidv4();
  await db.insert(teamsTable).values({
    id: teamId,
    name: `${ownerEmail.split("@")[0]}'s Team`,
    ownerId,
    scansUsed: 0,
    scansLimit: MONTHLY_SCANS_LIMIT,
    scansResetAt: new Date(),
  });
  await db.insert(teamMembersTable).values({
    id: uuidv4(),
    teamId,
    userId: ownerId,
    role: "owner",
  });
  await db.update(usersTable).set({ teamId }).where(eq(usersTable.id, ownerId));
  return teamId;
}

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.userPlan !== "team") {
      res.status(403).json(structuredError("PLAN", "Team plan required", `plan=${req.userPlan}`));
      return;
    }

    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = userRows[0];
    if (!user) { res.status(404).json(structuredError("AUTH", "User not found", "")); return; }

    let teamId = user.teamId;
    if (!teamId) {
      // Owner who hasn't been initialised — auto-create
      teamId = await ensureTeamForOwner(req.userId!, user.email);
    }

    const teamRows = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    const team = teamRows[0];
    if (!team) { res.status(404).json(structuredError("SYSTEM", "Team not found", `teamId=${teamId}`)); return; }

    const members = await db.select({
      id: teamMembersTable.id,
      userId: teamMembersTable.userId,
      role: teamMembersTable.role,
      joinedAt: teamMembersTable.joinedAt,
      email: usersTable.email,
    })
      .from(teamMembersTable)
      .leftJoin(usersTable, eq(usersTable.id, teamMembersTable.userId))
      .where(eq(teamMembersTable.teamId, teamId));

    const invites = await db.select().from(teamInvitesTable)
      .where(and(eq(teamInvitesTable.teamId, teamId)));
    const pendingInvites = invites.filter((i) => !i.acceptedAt && i.expiresAt > new Date());

    const membership = members.find((m) => m.userId === req.userId!);

    res.json({
      team: {
        id: team.id,
        name: team.name,
        ownerId: team.ownerId,
        scansUsed: team.scansUsed,
        scansLimit: team.scansLimit,
        scansResetAt: team.scansResetAt,
      },
      role: membership?.role ?? "member",
      members: members.map((m) => ({
        userId: m.userId, role: m.role, email: m.email, joinedAt: m.joinedAt,
      })),
      pendingInvites: pendingInvites.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        ...(membership?.role === "owner" ? { token: i.token } : {}),
      })),
      maxMembers: MAX_MEMBERS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ source: "TEAM", details: msg }, "Team: me failed");
    res.status(500).json(structuredError("TEAM", "Could not load team", msg));
  }
});

router.post("/invite", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email?.trim() || !email.includes("@")) {
    res.status(400).json(structuredError("VALIDATION", "Valid email required", `email=${email ?? "missing"}`));
    return;
  }

  try {
    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = userRows[0];
    if (!user || user.plan !== "team") {
      res.status(403).json(structuredError("PLAN", "Team plan required", `plan=${user?.plan ?? "none"}`));
      return;
    }

    let teamId = user.teamId ?? await ensureTeamForOwner(req.userId!, user.email);

    const teamRows = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    const team = teamRows[0];
    if (!team || team.ownerId !== req.userId!) {
      res.status(403).json(structuredError("AUTH", "Only the team owner can invite members", "not owner"));
      return;
    }

    const existingMembers = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, teamId));
    const pendingInvites = await db.select().from(teamInvitesTable).where(eq(teamInvitesTable.teamId, teamId));
    const activePending = pendingInvites.filter((i) => !i.acceptedAt && i.expiresAt > new Date());

    if (existingMembers.length + activePending.length >= MAX_MEMBERS) {
      res.status(403).json(structuredError("PLAN", `Team plan supports up to ${MAX_MEMBERS} members (including pending invites)`, `members=${existingMembers.length} pending=${activePending.length}`));
      return;
    }

    const token = crypto.randomBytes(24).toString("base64url");
    const inviteId = uuidv4();
    await db.insert(teamInvitesTable).values({
      id: inviteId,
      token,
      teamId,
      email: email.trim().toLowerCase(),
      invitedBy: req.userId!,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    // Best-effort send email via SendGrid
    const sgKey = process.env["SENDGRID_API_KEY"];
    if (sgKey) {
      const inviteUrl = `${req.protocol}://${req.get("host")}/team/join?token=${token}`;
      try {
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${sgKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: email.trim() }] }],
            from: { email: "noreply@contractai.app", name: "ContractAI" },
            subject: `You've been invited to join ${team.name} on ContractAI`,
            content: [{ type: "text/plain", value: `${user.email} invited you to join their ContractAI team.\n\nAccept this invite: ${inviteUrl}\n\nThis link expires in 7 days.` }],
          }),
        });
      } catch (mailErr) {
        req.log.warn({ source: "TEAM", details: mailErr instanceof Error ? mailErr.message : String(mailErr) }, "Team: invite email failed (link still works)");
      }
    }

    res.json({ success: true, inviteId, token, email: email.trim().toLowerCase() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ source: "TEAM", details: msg }, "Team: invite failed");
    res.status(500).json(structuredError("TEAM", "Could not send invite", msg));
  }
});

router.get("/invite/:token", async (req, res): Promise<void> => {
  try {
    const { token } = req.params as { token: string };
    const inviteRows = await db.select().from(teamInvitesTable).where(eq(teamInvitesTable.token, token)).limit(1);
    const invite = inviteRows[0];
    if (!invite) { res.status(404).json(structuredError("INVITE", "Invite not found", "")); return; }
    if (invite.acceptedAt) { res.status(400).json(structuredError("INVITE", "Invite already accepted", "")); return; }
    if (invite.expiresAt < new Date()) { res.status(400).json(structuredError("INVITE", "Invite expired", "")); return; }

    const teamRows = await db.select().from(teamsTable).where(eq(teamsTable.id, invite.teamId)).limit(1);
    const team = teamRows[0];
    res.json({
      teamId: invite.teamId,
      teamName: team?.name ?? "Team",
      email: invite.email,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    res.status(500).json(structuredError("TEAM", "Could not load invite", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/invite/:token/accept", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params as { token: string };
    const inviteRows = await db.select().from(teamInvitesTable).where(eq(teamInvitesTable.token, token)).limit(1);
    const invite = inviteRows[0];
    if (!invite) { res.status(404).json(structuredError("INVITE", "Invite not found", "")); return; }
    if (invite.acceptedAt) { res.status(400).json(structuredError("INVITE", "Invite already accepted", "")); return; }
    if (invite.expiresAt < new Date()) { res.status(400).json(structuredError("INVITE", "Invite expired", "")); return; }

    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = userRows[0];
    if (!user) { res.status(404).json(structuredError("AUTH", "User not found", "")); return; }
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      res.status(403).json(structuredError("AUTH", `This invite was sent to ${invite.email}. Sign in with that email to accept.`, `userEmail=${user.email} inviteEmail=${invite.email}`));
      return;
    }

    const existingMembers = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, invite.teamId));
    if (existingMembers.length >= MAX_MEMBERS) {
      res.status(403).json(structuredError("PLAN", "Team is full", `members=${existingMembers.length}`));
      return;
    }
    if (existingMembers.find((m) => m.userId === req.userId!)) {
      res.status(400).json(structuredError("INVITE", "You are already a member of this team", ""));
      return;
    }

    await db.insert(teamMembersTable).values({
      id: uuidv4(), teamId: invite.teamId, userId: req.userId!, role: "member",
    });

    await db.update(usersTable)
      .set({ teamId: invite.teamId, plan: "team" })
      .where(eq(usersTable.id, req.userId!));

    await db.update(teamInvitesTable)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvitesTable.id, invite.id));

    req.log.info({ source: "TEAM", userId: req.userId, teamId: invite.teamId }, "Team: invite accepted");
    res.json({ success: true, teamId: invite.teamId });
  } catch (err) {
    res.status(500).json(structuredError("TEAM", "Could not accept invite", err instanceof Error ? err.message : String(err)));
  }
});

router.delete("/members/:memberUserId", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { memberUserId } = req.params as { memberUserId: string };
    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = userRows[0];
    if (!user?.teamId) { res.status(404).json(structuredError("TEAM", "Not in a team", "")); return; }

    const teamRows = await db.select().from(teamsTable).where(eq(teamsTable.id, user.teamId)).limit(1);
    const team = teamRows[0];
    if (!team || team.ownerId !== req.userId!) {
      res.status(403).json(structuredError("AUTH", "Only the team owner can remove members", "not owner"));
      return;
    }
    if (memberUserId === team.ownerId) {
      res.status(400).json(structuredError("VALIDATION", "Cannot remove the team owner", ""));
      return;
    }
    await db.delete(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, user.teamId), eq(teamMembersTable.userId, memberUserId)));
    await db.update(usersTable)
      .set({ teamId: null, plan: "free" })
      .where(eq(usersTable.id, memberUserId));

    req.log.info({ source: "TEAM", removedUserId: memberUserId }, "Team: member removed");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(structuredError("TEAM", "Could not remove member", err instanceof Error ? err.message : String(err)));
  }
});

export { ensureTeamForOwner };
export default router;
