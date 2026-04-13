import { Router } from "express";
import type { Response } from "express";
import { db, contractsTable, analysesTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { db as dbClient, usersTable } from "@workspace/db";

const router = Router();

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: 999,
};

router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await dbClient.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "User not found" });
      return;
    }

    const allContracts = await db
      .select({ id: contractsTable.id, status: contractsTable.status })
      .from(contractsTable)
      .where(eq(contractsTable.userId, req.userId!));

    const totalContracts = allContracts.length;
    const analyzedContracts = allContracts.filter((c) => c.status === "analyzed").length;

    const analyzedIds = allContracts.filter((c) => c.status === "analyzed").map((c) => c.id);
    let highRiskContracts = 0;

    if (analyzedIds.length > 0) {
      const analyses = await db
        .select({ riskLevel: analysesTable.riskLevel })
        .from(analysesTable)
        .where(eq(analysesTable.riskLevel, "high"));

      highRiskContracts = analyses.filter((a) =>
        analyzedIds.some((id) => a.riskLevel === "high")
      ).length;

      const highRiskAnalyses = await db
        .select({ contractId: analysesTable.contractId })
        .from(analysesTable)
        .where(eq(analysesTable.riskLevel, "high"));

      highRiskContracts = highRiskAnalyses.filter((a) =>
        analyzedIds.includes(a.contractId)
      ).length;
    }

    const limit = PLAN_LIMITS[user.plan] ?? 3;
    const planUsagePercent = limit === 999 ? Math.round((user.contractsUsed / 100) * 100) : Math.round((user.contractsUsed / limit) * 100);

    res.json({
      totalContracts,
      analyzedContracts,
      highRiskContracts,
      planUsagePercent: Math.min(planUsagePercent, 100),
      plan: user.plan,
      contractsUsed: user.contractsUsed,
      contractsLimit: limit,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "InternalError", message: "Failed to get stats" });
  }
});

router.get("/recent", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const contracts = await db
      .select({
        id: contractsTable.id,
        filename: contractsTable.filename,
        status: contractsTable.status,
        createdAt: contractsTable.createdAt,
        analyzedAt: contractsTable.analyzedAt,
      })
      .from(contractsTable)
      .where(eq(contractsTable.userId, req.userId!))
      .orderBy(contractsTable.createdAt)
      .limit(10);

    const recentContracts = contracts.reverse();

    const activities = await Promise.all(
      recentContracts.map(async (contract) => {
        let riskLevel: string | null = null;
        if (contract.status === "analyzed") {
          const analyses = await db
            .select({ riskLevel: analysesTable.riskLevel })
            .from(analysesTable)
            .where(eq(analysesTable.contractId, contract.id))
            .limit(1);
          riskLevel = analyses[0]?.riskLevel ?? null;
        }

        return {
          id: `act-${contract.id}`,
          contractId: contract.id,
          filename: contract.filename,
          action: contract.status === "analyzed" ? "Analyzed" : contract.status === "failed" ? "Analysis Failed" : "Uploaded",
          riskLevel,
          createdAt: contract.analyzedAt ?? contract.createdAt,
        };
      })
    );

    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "InternalError", message: "Failed to get recent activity" });
  }
});

export default router;
