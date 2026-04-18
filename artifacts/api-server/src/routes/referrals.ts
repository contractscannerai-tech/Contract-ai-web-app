import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function generateReferralCode(): string {
  return `CAI-${uuidv4().slice(0, 8).toUpperCase()}`;
}

function badgeFor(points: number): string {
  if (points >= 200) return "Diamond";
  if (points >= 100) return "Gold";
  if (points >= 50) return "Silver";
  if (points >= 10) return "Bronze";
  return "Newcomer";
}

router.get("/code", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    let code = user.referralCode;
    if (!code) {
      code = generateReferralCode();
      await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, req.userId!));
    }

    const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.userId!));
    const totalScansAwarded = referrals.reduce((sum, r) => sum + r.scansAwarded, 0);

    res.json({
      referralCode: code,
      totalReferrals: referrals.length,
      totalScansAwarded,
      points: user.referralPoints ?? 0,
      badge: badgeFor(user.referralPoints ?? 0),
      referrals: referrals.map((r) => ({
        status: r.status,
        scansAwarded: r.scansAwarded,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Referral: failed to get code");
    res.status(500).json({ error: "InternalError", message: "Failed to get referral code" });
  }
});

router.post("/claim", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { referralCode } = req.body as { referralCode?: string };
  if (!referralCode?.trim()) {
    res.status(400).json({ error: "BadRequest", message: "Referral code is required" });
    return;
  }

  try {
    const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!currentUser[0]) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    if (currentUser[0].referredBy) {
      res.status(400).json({ error: "AlreadyReferred", message: "You have already used a referral code" });
      return;
    }

    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.trim().toUpperCase())).limit(1);
    if (!referrer[0]) {
      res.status(404).json({ error: "InvalidCode", message: "This referral code is not valid" });
      return;
    }

    if (referrer[0].id === req.userId) {
      res.status(400).json({ error: "SelfReferral", message: "You cannot use your own referral code" });
      return;
    }

    const scansToAward = 3;
    const POINTS_FOR_SIGNUP = 5;

    await db.insert(referralsTable).values({
      id: uuidv4(),
      referrerId: referrer[0].id,
      referredId: req.userId!,
      status: "signed_up",
      scansAwarded: scansToAward,
    });

    await db.update(usersTable)
      .set({ referredBy: referrer[0].id })
      .where(eq(usersTable.id, req.userId!));

    await db.update(usersTable)
      .set({
        bonusScans: (referrer[0].bonusScans ?? 0) + scansToAward,
        referralPoints: (referrer[0].referralPoints ?? 0) + POINTS_FOR_SIGNUP,
      })
      .where(eq(usersTable.id, referrer[0].id));

    req.log.info({ referrerId: referrer[0].id, referredId: req.userId, scansAwarded: scansToAward, points: POINTS_FOR_SIGNUP }, "Referral: code claimed");
    res.json({ message: "Referral code applied successfully", scansAwarded: scansToAward });
  } catch (err) {
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Referral: claim failed");
    res.status(500).json({ error: "InternalError", message: "Failed to apply referral code" });
  }
});

// Monthly leaderboard: top referrers by points earned this month
router.get("/leaderboard", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // Compute current-month points per referrer from referrals table
    // signup=5, subscribed_pro=20, subscribed_premium=50
    const rows = await db.execute<{ referrer_id: string; points: number; signups: number }>(sql`
      SELECT
        ${referralsTable.referrerId} AS referrer_id,
        SUM(CASE
          WHEN ${referralsTable.status} = 'subscribed_premium' THEN 50
          WHEN ${referralsTable.status} = 'subscribed_pro' THEN 20
          ELSE 5
        END)::int AS points,
        COUNT(*)::int AS signups
      FROM ${referralsTable}
      WHERE ${referralsTable.createdAt} >= ${monthStart}
      GROUP BY ${referralsTable.referrerId}
      ORDER BY points DESC
      LIMIT 50
    `);

    const referrerIds = rows.rows.map((r) => r.referrer_id);
    const userMap = new Map<string, { email: string }>();
    if (referrerIds.length > 0) {
      const userRows = await db.execute<{ id: string; email: string }>(sql`
        SELECT id, email FROM ${usersTable}
        WHERE id IN (${sql.join(referrerIds.map((id) => sql`${id}`), sql`, `)})
      `);
      for (const u of userRows.rows) userMap.set(u.id, { email: u.email });
    }

    const leaderboard = rows.rows.map((r, idx) => {
      const email = userMap.get(r.referrer_id)?.email ?? "user";
      const masked = email.includes("@")
        ? `${email.split("@")[0]!.slice(0, 3)}***@${email.split("@")[1]}`
        : "user";
      return {
        rank: idx + 1,
        userId: r.referrer_id,
        displayName: masked,
        points: r.points,
        signups: r.signups,
        badge: badgeFor(r.points),
        isYou: r.referrer_id === req.userId,
      };
    });

    // Find user's row even if not in top 50
    const me = leaderboard.find((r) => r.isYou);
    let myRank: { rank: number; points: number; badge: string } | null = me ? { rank: me.rank, points: me.points, badge: me.badge } : null;
    if (!myRank) {
      const myRows = await db.execute<{ points: number; rank: number }>(sql`
        WITH monthly AS (
          SELECT
            ${referralsTable.referrerId} AS referrer_id,
            SUM(CASE
              WHEN ${referralsTable.status} = 'subscribed_premium' THEN 50
              WHEN ${referralsTable.status} = 'subscribed_pro' THEN 20
              ELSE 5
            END)::int AS points
          FROM ${referralsTable}
          WHERE ${referralsTable.createdAt} >= ${monthStart}
          GROUP BY ${referralsTable.referrerId}
        )
        SELECT points, RANK() OVER (ORDER BY points DESC) AS rank
        FROM monthly
        WHERE referrer_id = ${req.userId!}
        LIMIT 1
      `);
      if (myRows.rows[0]) {
        myRank = { rank: Number(myRows.rows[0].rank), points: myRows.rows[0].points, badge: badgeFor(myRows.rows[0].points) };
      }
    }

    res.json({
      monthStart: monthStart.toISOString(),
      leaderboard,
      myRank,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "REFERRAL", details: msg }, "Leaderboard: failed");
    res.status(500).json({ error: "InternalError", message: "Failed to load leaderboard" });
  }
});

export default router;
