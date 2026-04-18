import { Router } from "express";
import type { Response } from "express";
import Groq from "groq-sdk";
import { db, contractsTable, analysesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { db as dbClient, usersTable } from "@workspace/db";

const router = Router();

function getGroq() {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey: key });
}

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

// Live AI insights powered by Groq, personalized using user context.
const insightCache = new Map<string, { insights: string[]; expiresAt: number }>();
const INSIGHT_CACHE_TTL_MS = 5 * 60 * 1000;

router.get("/insights", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const force = req.query["refresh"] === "1";
    const cached = insightCache.get(userId);

    if (!force && cached && cached.expiresAt > Date.now()) {
      res.json({ insights: cached.insights, cached: true });
      return;
    }

    const userRows = await dbClient.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = userRows[0];

    const recent = await db
      .select({
        id: contractsTable.id,
        filename: contractsTable.filename,
        status: contractsTable.status,
      })
      .from(contractsTable)
      .where(eq(contractsTable.userId, userId))
      .orderBy(desc(contractsTable.createdAt))
      .limit(5);

    const userContractIds = recent.map((r) => r.id);
    const userRiskLevels: string[] = [];
    if (userContractIds.length > 0) {
      const riskRows = await db
        .select({ riskLevel: analysesTable.riskLevel })
        .from(analysesTable)
        .where(inArray(analysesTable.contractId, userContractIds))
        .orderBy(desc(analysesTable.createdAt))
        .limit(5);
      userRiskLevels.push(...riskRows.map((r) => r.riskLevel));
    }

    const profile = [
      user?.displayName ? `Name: ${user.displayName}` : "",
      user?.profession ? `Profession: ${user.profession}` : "",
      `Plan: ${user?.plan ?? "free"}`,
      recent.length > 0 ? `Recent contracts: ${recent.map((r) => r.filename).join(", ")}` : "No contracts yet",
      userRiskLevels.length > 0 ? `Recent risk levels seen: ${userRiskLevels.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const seed = Math.floor(Math.random() * 100000);

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 1.0,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You are ContractAI's insight engine. Generate 8 short, punchy, ACTIONABLE legal-contract insights for a user, each one a single sentence, 12-22 words. Each insight must be unique and useful — covering termination, liability, IP, confidentiality, payment, indemnification, jurisdiction, force majeure, change of control, non-compete, auto-renewal, governing law, warranties, dispute resolution, etc. Vary the topics and angles. Personalize when context is provided. No numbering. No quotes. Output ONLY a JSON array of strings, nothing else. Random seed: ${seed}.`,
        },
        {
          role: "user",
          content: `User context:\n${profile}\n\nReturn 8 fresh insights as a JSON array of strings.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    let insights: string[] = [];
    if (Array.isArray(parsed)) {
      insights = (parsed as unknown[]).filter((s): s is string => typeof s === "string");
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const arr = obj["insights"] ?? obj["tips"] ?? obj["items"] ?? Object.values(obj)[0];
      if (Array.isArray(arr)) {
        insights = (arr as unknown[]).filter((s): s is string => typeof s === "string");
      }
    }

    insights = insights.map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 220).slice(0, 12);

    if (insights.length === 0) {
      res.status(502).json({ error: "INSIGHTS", message: "Could not generate insights", insights: [] });
      return;
    }

    insightCache.set(userId, { insights, expiresAt: Date.now() + INSIGHT_CACHE_TTL_MS });
    res.json({ insights, cached: false });
  } catch (err) {
    req.log.error({ err, source: "INSIGHTS" }, "Insights generation failed");
    res.status(500).json({ error: "InternalError", message: "Failed to generate insights", insights: [] });
  }
});

export default router;
