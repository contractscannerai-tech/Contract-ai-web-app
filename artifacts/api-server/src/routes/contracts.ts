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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_MIMETYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or image files (JPEG, PNG, WebP) are allowed"));
    }
  },
});

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: 999,
};

async function extractTextWithOCR(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  const ocrApiKey = process.env["OCR_API_KEY"];
  if (!ocrApiKey) {
    throw new Error("OCR_API_KEY is not configured");
  }

  const isImage = mimetype.startsWith("image/");
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimetype });
  formData.append("file", blob, filename);
  formData.append("apikey", ocrApiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  if (!isImage) {
    formData.append("filetype", "PDF");
  }
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("isTable", "false");
  formData.append("OCREngine", "2");

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OCR API HTTP ${response.status}: ${await response.text().catch(() => "(unreadable)")}`);
      }

      const data = await response.json() as {
        IsErroredOnProcessing?: boolean;
        ErrorMessage?: string[];
        ParsedResults?: Array<{ ParsedText: string }>;
      };

      if (data.IsErroredOnProcessing) {
        throw new Error(`OCR processing error: ${data.ErrorMessage?.join(", ") ?? "unknown"}`);
      }

      const text = data.ParsedResults?.map((r) => r.ParsedText).join("\n") ?? "";
      if (!text.trim()) {
        throw new Error("OCR returned empty text — file may be image-only, scanned at low quality, or password protected");
      }

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("OCR failed after 3 attempts");
}

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
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "List contracts error");
    res.status(500).json({ error: "InternalError", message: "Failed to list contracts" });
  }
});

router.post("/upload", requireAuth, uploadLimiter, (req: AuthenticatedRequest, res: Response) => {
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
          message: `Your ${user.plan} plan allows ${limit} contract${limit === 1 ? "" : "s"}. Please upgrade to upload more.`,
          plan: user.plan,
          limit,
        });
        return;
      }

      const { buffer, originalname, mimetype, size } = req.file;

      const isImageUpload = mimetype.startsWith("image/");
      if (isImageUpload && user.plan === "free") {
        res.status(403).json({
          error: "PlanRequired",
          message: "Photo scanning is available on Pro and Premium plans. Please upgrade to scan contract photos.",
          plan: user.plan,
          requiredPlan: "pro",
        });
        return;
      }

      const contractId = uuidv4();

      req.log.info({
        source: "OCR",
        contractId,
        filename: originalname,
        mimetype,
        size,
      }, "OCR: starting text extraction at upload time");

      let extractedText: string | null = null;
      let initialStatus: "extracted" | "failed" = "extracted";

      try {
        extractedText = await extractTextWithOCR(buffer, originalname, mimetype);
        req.log.info({ source: "OCR", contractId, charCount: extractedText.length }, "OCR: extraction successful");
      } catch (ocrErr) {
        const errMsg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        req.log.error({
          error: true,
          source: "OCR",
          message: "OCR extraction failed at upload time",
          details: errMsg,
          contractId,
          filename: originalname,
          mimetype,
        }, "OCR: extraction failed");
        initialStatus = "failed";
      }

      const [contract] = await db.insert(contractsTable).values({
        id: contractId,
        userId: req.userId!,
        filename: originalname,
        fileSize: size,
        status: initialStatus,
        extractedText,
      }).returning();

      await db.update(usersTable)
        .set({ contractsUsed: user.contractsUsed + 1 })
        .where(eq(usersTable.id, req.userId!));

      req.log.info({ source: "SYSTEM", contractId, filename: originalname, status: initialStatus }, "Contract uploaded and processed");

      res.json(contract);
    } catch (dbErr) {
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      req.log.error({ error: true, source: "SYSTEM", message: "DB error during upload", details: errMsg }, "Upload DB error");
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
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Get contract error");
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

    req.log.info({ source: "SYSTEM", contractId: id }, "Contract deleted");
    res.json({ success: true, message: "Contract deleted" });
  } catch (err) {
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Delete contract error");
    res.status(500).json({ error: "InternalError", message: "Failed to delete contract" });
  }
});

export default router;
