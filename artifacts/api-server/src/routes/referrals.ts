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

// ---------------------------------------------------------------------------
// Synthetic "competitor" leaderboard entries.
// While the real referral community is still small, we surface a pool of
// believable competitors so the leaderboard feels active and competitive.
// Their point totals slowly tick up over time (hourly drift) so the board
// looks live, similar to how the AI insight bubbles rotate.
//
// As real users grow, fewer synthetic entries are shown — and any real user
// that out-scores a synthetic one naturally outranks them via sort order.
// The synthetic flag is NEVER exposed to the client.
// ---------------------------------------------------------------------------
type FakePersona = {
  id: string;     // stable synthetic id (prefixed so it never collides w/ real uuids)
  name: string;   // already-masked display name
  endTarget: number; // points the persona will reach by the end of the month
};

// Personas are tiered roughly Diamond (>200) → Gold (>100) → Silver (>50) → Bronze (>10) → Newcomer.
const FAKE_PERSONAS: FakePersona[] = [
  { id: "syn-01", name: "ale***@gmail.com",      endTarget: 460 },
  { id: "syn-02", name: "sar***@outlook.com",    endTarget: 420 },
  { id: "syn-03", name: "raj***@gmail.com",      endTarget: 385 },
  { id: "syn-04", name: "mar***@yahoo.com",      endTarget: 350 },
  { id: "syn-05", name: "pri***@hotmail.com",    endTarget: 315 },
  { id: "syn-06", name: "dav***@gmail.com",      endTarget: 285 },
  { id: "syn-07", name: "emi***@icloud.com",     endTarget: 255 },
  { id: "syn-08", name: "joh***@gmail.com",      endTarget: 230 },
  { id: "syn-09", name: "lin***@outlook.com",    endTarget: 205 },
  { id: "syn-10", name: "mic***@gmail.com",      endTarget: 180 },
  { id: "syn-11", name: "nat***@yahoo.com",      endTarget: 160 },
  { id: "syn-12", name: "oli***@gmail.com",      endTarget: 140 },
  { id: "syn-13", name: "pat***@protonmail.com", endTarget: 125 },
  { id: "syn-14", name: "qui***@gmail.com",      endTarget: 110 },
  { id: "syn-15", name: "rob***@outlook.com",    endTarget:  95 },
  { id: "syn-16", name: "sam***@gmail.com",      endTarget:  80 },
  { id: "syn-17", name: "tom***@yahoo.com",      endTarget:  68 },
  { id: "syn-18", name: "uma***@gmail.com",      endTarget:  58 },
  { id: "syn-19", name: "vic***@hotmail.com",    endTarget:  48 },
  { id: "syn-20", name: "wil***@gmail.com",      endTarget:  40 },
  { id: "syn-21", name: "xav***@icloud.com",     endTarget:  33 },
  { id: "syn-22", name: "yas***@gmail.com",      endTarget:  27 },
  { id: "syn-23", name: "zac***@outlook.com",    endTarget:  22 },
  { id: "syn-24", name: "amy***@gmail.com",      endTarget:  18 },
  { id: "syn-25", name: "ben***@yahoo.com",      endTarget:  15 },
  { id: "syn-26", name: "cla***@gmail.com",      endTarget:  12 },
  { id: "syn-27", name: "dan***@outlook.com",    endTarget:  10 },
  { id: "syn-28", name: "eva***@gmail.com",      endTarget:   8 },
  { id: "syn-29", name: "fra***@protonmail.com", endTarget:   6 },
  { id: "syn-30", name: "gin***@gmail.com",      endTarget:   5 },
];

// Returns synthetic entries with current point totals based on a smooth
// progression from ~25% of endTarget at month start → 100% at month end.
// Points climb hour-by-hour (in 3-hour buckets) so the board feels live —
// like the AI insight bubbles — without flickering on every refresh.
function buildFakeEntries(monthStart: Date, now: Date): { id: string; name: string; points: number; signups: number }[] {
  const hoursInMonth = 30 * 24; // approximate
  const hoursElapsed = Math.max(0, (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60));
  // Snap to 3-hour buckets so the same value is returned across multiple page loads
  // within a 3-hour window — gives the "AI insight" feel of stable-then-update.
  const bucketHours = Math.floor(hoursElapsed / 3) * 3;
  const progress = Math.min(1, Math.max(0.25, bucketHours / hoursInMonth + 0.25));
  return FAKE_PERSONAS.map((p) => {
    const points = Math.max(1, Math.floor(p.endTarget * progress));
    // Rough signup count: assume mixed signup (5pt) + occasional upgrade (20pt) → ~8pt avg
    const signups = Math.max(1, Math.round(points / 8));
    return { id: p.id, name: p.name, points, signups };
  });
}

// Monthly leaderboard: top referrers by points earned this month
router.get("/leaderboard", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
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

    // Real entries (from DB)
    type MergedEntry = {
      userId: string;
      displayName: string;
      points: number;
      signups: number;
      isYou: boolean;
    };
    const realEntries: MergedEntry[] = rows.rows.map((r) => {
      const email = userMap.get(r.referrer_id)?.email ?? "user";
      const masked = email.includes("@")
        ? `${email.split("@")[0]!.slice(0, 3)}***@${email.split("@")[1]}`
        : "user";
      return {
        userId: r.referrer_id,
        displayName: masked,
        points: r.points,
        signups: r.signups,
        isYou: r.referrer_id === req.userId,
      };
    });

    // Synthetic competitor entries — quantity tapers off as the real community grows.
    // We always show enough total entries to make the board feel competitive (target ~25),
    // but never more than the FAKE_PERSONAS pool size.
    const TARGET_TOTAL = 25;
    const targetFakes = Math.max(0, Math.min(FAKE_PERSONAS.length, TARGET_TOTAL - realEntries.length));
    const allFakesSorted = buildFakeEntries(monthStart, now).sort((a, b) => b.points - a.points);
    const visibleFakes = allFakesSorted.slice(0, targetFakes);
    const fakeEntries: MergedEntry[] = visibleFakes.map((f) => ({
      userId: f.id,
      displayName: f.name,
      points: f.points,
      signups: f.signups,
      isYou: false,
    }));

    // Merge, sort by points desc (real users naturally outrank fakes once they pass them),
    // then assign ranks. Cap at top 50.
    const merged = [...realEntries, ...fakeEntries]
      .sort((a, b) => b.points - a.points)
      .slice(0, 50)
      .map((e, idx) => ({
        rank: idx + 1,
        userId: e.userId,
        displayName: e.displayName,
        points: e.points,
        signups: e.signups,
        badge: badgeFor(e.points),
        isYou: e.isYou,
      }));

    // Find user's row even if not in top 50 — rank is computed against merged set
    // (real entries + synthetic competitors) so the user's perceived position is consistent.
    let myRank: { rank: number; points: number; badge: string } | null = null;
    const meInTop = merged.find((r) => r.isYou);
    if (meInTop) {
      myRank = { rank: meInTop.rank, points: meInTop.points, badge: meInTop.badge };
    } else {
      // The user is below top 50. Compute their points and the number of REAL
      // users ahead via SQL (not limited to top 50), then add the count of
      // VISIBLE synthetic competitors with strictly more points.
      const myRows = await db.execute<{ points: number; real_ahead: number }>(sql`
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
        ),
        me AS (SELECT points FROM monthly WHERE referrer_id = ${req.userId!})
        SELECT
          (SELECT points FROM me) AS points,
          (SELECT COUNT(*) FROM monthly WHERE points > (SELECT points FROM me))::int AS real_ahead
      `);
      const r0 = myRows.rows[0];
      if (r0 && r0.points != null) {
        const myPts = r0.points;
        const fakesAhead = visibleFakes.filter((f) => f.points > myPts).length;
        const ahead = Number(r0.real_ahead) + fakesAhead;
        myRank = { rank: ahead + 1, points: myPts, badge: badgeFor(myPts) };
      }
    }

    res.json({
      monthStart: monthStart.toISOString(),
      leaderboard: merged,
      myRank,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "REFERRAL", details: msg }, "Leaderboard: failed");
    res.status(500).json({ error: "InternalError", message: "Failed to load leaderboard" });
  }
});

export default router;
