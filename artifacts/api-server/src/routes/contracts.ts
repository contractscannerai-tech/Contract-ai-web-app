import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { db, contractsTable, analysesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadLimiter } from "../lib/rate-limit.js";

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: 999,
};

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const contracts = await db
      .select({
        id: contractsTable.id,
        userId: contractsTable.userId,
        filename: contractsTable.filename,
        fileSize: contractsTable.fileSize,
        status: contractsTable.status,
        createdAt: contractsTable.createdAt,
        analyzedAt: contractsTable.analyzedAt,
      })
      .from(contractsTable)
      .where(eq(contractsTable.userId, req.userId!))
      .orderBy(contractsTable.createdAt);

    res.json(contracts.reverse());
  } catch (err) {
    req.log.error({ err }, "List contracts error");
    res.status(500).json({ error: "InternalError", message: "Failed to list contracts" });
  }
});

router.post("/upload", requireAuth, uploadLimiter, (req: AuthenticatedRequest, res: Response, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "FileTooLarge", message: "File must be under 10MB" });
        return;
      }
      res.status(400).json({ error: "UploadError", message: err.message });
      return;
    } else if (err) {
      res.status(400).json({ error: "UploadError", message: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "NoFile", message: "No file uploaded" });
      return;
    }

    try {
      const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      const user = users[0];

      if (!user) {
        res.status(401).json({ error: "Unauthorized", message: "User not found" });
        return;
      }

      const limit = PLAN_LIMITS[user.plan] ?? 3;
      if (user.contractsUsed >= limit) {
        res.status(403).json({
          error: "PlanLimitReached",
          message: `Your ${user.plan} plan allows ${limit} contracts. Please upgrade to upload more.`,
        });
        return;
      }

      const contractId = uuidv4();
      const [contract] = await db.insert(contractsTable).values({
        id: contractId,
        userId: req.userId!,
        filename: req.file.originalname,
        fileSize: req.file.size,
        status: "uploaded",
      }).returning();

      await db.update(usersTable)
        .set({ contractsUsed: user.contractsUsed + 1 })
        .where(eq(usersTable.id, req.userId!));

      req.log.info({ contractId, filename: req.file.originalname }, "Contract uploaded");

      res.json(contract);
    } catch (dbErr) {
      req.log.error({ dbErr }, "Upload DB error");
      res.status(500).json({ error: "InternalError", message: "Upload failed" });
    }
  });
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const contracts = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, req.userId!)))
      .limit(1);

    if (contracts.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Contract not found" });
      return;
    }

    const contract = contracts[0];
    const analyses = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.contractId, id))
      .limit(1);

    res.json({
      ...contract,
      analysis: analyses[0] ?? null,
      extractedText: contract.extractedText ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Get contract error");
    res.status(500).json({ error: "InternalError", message: "Failed to get contract" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const contracts = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq(contractsTable.userId, req.userId!)))
      .limit(1);

    if (contracts.length === 0) {
      res.status(404).json({ error: "NotFound", message: "Contract not found" });
      return;
    }

    await db.delete(analysesTable).where(eq(analysesTable.contractId, id));
    await db.delete(contractsTable).where(eq(contractsTable.id, id));

    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (user && user.contractsUsed > 0) {
      await db.update(usersTable)
        .set({ contractsUsed: user.contractsUsed - 1 })
        .where(eq(usersTable.id, req.userId!));
    }

    req.log.info({ contractId: id }, "Contract deleted");
    res.json({ success: true, message: "Contract deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete contract error");
    res.status(500).json({ error: "InternalError", message: "Failed to delete contract" });
  }
});

export default router;
