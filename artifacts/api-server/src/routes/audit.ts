import { Router } from "express";
import type { Response } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const HISTORY_LIMITS: Record<string, number> = { free: 5, pro: 50, premium: 9999, team: 9999 };

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

router.get("/history", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const plan = req.userPlan ?? "free";
    const planLimit = HISTORY_LIMITS[plan] ?? 5;

    const fromStr = typeof req.query["from"] === "string" ? req.query["from"] : null;
    const toStr = typeof req.query["to"] === "string" ? req.query["to"] : null;
    const minScoreStr = typeof req.query["minScore"] === "string" ? req.query["minScore"] : null;
    const maxScoreStr = typeof req.query["maxScore"] === "string" ? req.query["maxScore"] : null;
    const contractType = typeof req.query["type"] === "string" && req.query["type"] !== "all" ? req.query["type"] : null;

    const conditions = [eq(auditLogsTable.userId, req.userId!)];

    if (fromStr) {
      const d = new Date(fromStr);
      if (!Number.isNaN(d.getTime())) conditions.push(gte(auditLogsTable.createdAt, d));
    }
    if (toStr) {
      const d = new Date(toStr);
      if (!Number.isNaN(d.getTime())) {
        d.setUTCHours(23, 59, 59, 999);
        conditions.push(lte(auditLogsTable.createdAt, d));
      }
    }
    if (minScoreStr !== null) {
      const n = Number(minScoreStr);
      if (Number.isFinite(n)) conditions.push(gte(auditLogsTable.riskScore, Math.round(n)));
    }
    if (maxScoreStr !== null) {
      const n = Number(maxScoreStr);
      if (Number.isFinite(n)) conditions.push(lte(auditLogsTable.riskScore, Math.round(n)));
    }
    if (contractType) {
      conditions.push(eq(auditLogsTable.contractType, contractType));
    }

    const totalRows = await db.select({ c: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .where(and(...conditions));
    const totalMatching = totalRows[0]?.c ?? 0;

    const rows = await db.select()
      .from(auditLogsTable)
      .where(and(...conditions))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(planLimit);

    // Distinct contract types for the filter UI (across user's full history, no plan limit)
    const typeRows = await db.selectDistinct({ contractType: auditLogsTable.contractType })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.userId, req.userId!));
    const types = typeRows.map((r) => r.contractType).filter((t): t is string => Boolean(t));

    res.json({
      plan,
      planLimit: planLimit >= 9999 ? null : planLimit,
      totalMatching,
      truncated: totalMatching > rows.length,
      contractTypes: types.sort(),
      records: rows.map((r) => ({
        id: r.id,
        action: r.action,
        contractId: r.contractId,
        riskScore: r.riskScore,
        contractType: r.contractType,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "AUDIT", details: msg }, "Audit: history fetch failed");
    res.status(500).json(structuredError("AUDIT", "Failed to fetch history", msg));
  }
});

export default router;
