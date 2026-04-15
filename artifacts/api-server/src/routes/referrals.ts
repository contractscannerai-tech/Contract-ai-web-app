import { Router } from "express";
import type { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function generateReferralCode(): string {
  return `CAI-${uuidv4().slice(0, 8).toUpperCase()}`;
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

    await db.insert(referralsTable).values({
      id: uuidv4(),
      referrerId: referrer[0].id,
      referredId: req.userId!,
      status: "signed_up",
      scansAwarded: scansToAward,
    });

    await db.update(usersTable)
      .set({
        referredBy: referrer[0].id,
      })
      .where(eq(usersTable.id, req.userId!));

    await db.update(usersTable)
      .set({
        bonusScans: (referrer[0].bonusScans ?? 0) + scansToAward,
      })
      .where(eq(usersTable.id, referrer[0].id));

    req.log.info({ referrerId: referrer[0].id, referredId: req.userId, scansAwarded: scansToAward }, "Referral: code claimed");
    res.json({ message: "Referral code applied successfully", scansAwarded: scansToAward });
  } catch (err) {
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Referral: claim failed");
    res.status(500).json({ error: "InternalError", message: "Failed to apply referral code" });
  }
});

export default router;
