import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
// Import the underlying library directly to avoid pdf-parse@1.1.1's
// import-time test-file read (known bug when run outside its own directory)
import pdfParse from "pdf-parse/lib/pdf-parse.js";
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
  pro: 20,
  premium: 999,
};

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  const text = (data.text ?? "").trim();
  if (!text) {
    throw new Error("PDF text extraction returned empty content — the PDF may be scanned/image-only. Try uploading a photo of it instead (Pro/Premium).");
  }
  return text;
}

async function extractTextWithOCR(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  const ocrApiKey = process.env["OCR_API_KEY"];
  if (!ocrApiKey) throw new Error("OCR_API_KEY is not configured");

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimetype });
  formData.append("file", blob, filename);
  formData.append("apikey", ocrApiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
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
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`OCR API HTTP ${response.status}: ${await response.text().catch(() => "(unreadable)")}`);
      }

      const result = await response.json() as {
        IsErroredOnProcessing?: boolean;
        ErrorMessage?: string[];
        ParsedResults?: Array<{ ParsedText: string }>;
      };

      if (result.IsErroredOnProcessing) {
        throw new Error(`OCR processing error: ${result.ErrorMessage?.join(", ") ?? "unknown"}`);
      }

      const text = result.ParsedResults?.map((r) => r.ParsedText).join("\n") ?? "";
      if (!text.trim()) {
        throw new Error("OCR returned empty text — image may be low quality, blurry, or password-protected");
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

type ExtractionResult = {
  text: string;
  method: "pdf-parse" | "ocr";
};

/**
 * Sanitize an uploaded filename:
 * - Strip directory traversal sequences
 * - Remove non-ASCII / control characters
 * - Replace whitespace and unsafe chars with underscores
 * - Truncate to a safe max length
 */
function sanitizeFilename(raw: string): string {
  // Remove any directory components
  const basename = raw.replace(/^.*[\\/]/, "");
  // Strip null bytes and control characters
  const noCtrl = basename.replace(/[\x00-\x1f\x7f]/g, "");
  // Replace characters that are unsafe in filenames/URLs
  const safe = noCtrl.replace(/[^a-zA-Z0-9._\- ]/g, "_").replace(/\s+/g, "_");
  // Collapse multiple underscores
  const collapsed = safe.replace(/_+/g, "_").replace(/^_|_$/g, "");
  // Preserve extension, truncate stem so total ≤ 200 chars
  const dot = collapsed.lastIndexOf(".");
  const ext = dot !== -1 ? collapsed.slice(dot) : "";
  const stem = dot !== -1 ? collapsed.slice(0, dot) : collapsed;
  const maxStem = 200 - ext.length;
  return (stem.slice(0, maxStem) || "upload") + ext;
}

async function extractText(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ExtractionResult> {
  if (mimetype === "application/pdf") {
    const text = await extractTextFromPDF(buffer);
    return { text, method: "pdf-parse" };
  }
  const text = await extractTextWithOCR(buffer, filename, mimetype);
  return { text, method: "ocr" };
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

      const { buffer, originalname: rawFilename, mimetype, size } = req.file;
      const originalname = sanitizeFilename(rawFilename);

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
      const isPDF = mimetype === "application/pdf";
      const source = isPDF ? "PDF" : "OCR";

      req.log.info({
        source,
        contractId,
        filename: originalname,
        mimetype,
        size,
        method: isPDF ? "pdf-parse" : "ocr",
      }, isPDF ? "PDF: extracting digital text directly" : "OCR: scanning image for text");

      let extractedText: string | null = null;
      let initialStatus: "extracted" | "failed" = "extracted";
      let processingMethod: "pdf-parse" | "ocr" = isPDF ? "pdf-parse" : "ocr";

      try {
        const result = await extractText(buffer, originalname, mimetype);
        extractedText = result.text;
        processingMethod = result.method;
        req.log.info({
          source,
          contractId,
          method: result.method,
          charCount: extractedText.length,
        }, isPDF ? "PDF: text extracted successfully" : "OCR: scan completed successfully");
      } catch (extractErr) {
        const errMsg = extractErr instanceof Error ? extractErr.message : String(extractErr);
        req.log.error({
          error: true,
          source,
          message: isPDF ? "PDF text extraction failed" : "OCR extraction failed",
          details: errMsg,
          contractId,
          filename: originalname,
          mimetype,
        }, isPDF ? "PDF: extraction failed" : "OCR: extraction failed");
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

      req.log.info({
        source: "SYSTEM",
        contractId,
        filename: originalname,
        status: initialStatus,
        method: processingMethod,
      }, "Contract stored — credit charged only after successful AI analysis");

      res.json({ ...contract, processingMethod });
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

    // PRIVACY: Never return raw extracted text to the client — only structured analysis results
    res.json({
      id: contract.id,
      userId: contract.userId,
      filename: contract.filename,
      fileSize: contract.fileSize,
      status: contract.status,
      createdAt: contract.createdAt,
      analyzedAt: contract.analyzedAt,
      analysis: analyses[0] ?? null,
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

    const wasAnalyzed = contracts[0].status === "analyzed";

    await db.delete(analysesTable).where(eq(analysesTable.contractId, id));
    await db.delete(contractsTable).where(eq(contractsTable.id, id));

    if (wasAnalyzed) {
      const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      const user = users[0];
      if (user && user.contractsUsed > 0) {
        await db.update(usersTable)
          .set({ contractsUsed: user.contractsUsed - 1 })
          .where(eq(usersTable.id, req.userId!));
      }
    }

    req.log.info({ source: "SYSTEM", contractId: id, wasAnalyzed }, "Contract deleted");
    res.json({ success: true, message: "Contract deleted" });
  } catch (err) {
    req.log.error({ error: true, source: "SYSTEM", details: err instanceof Error ? err.message : String(err) }, "Delete contract error");
    res.status(500).json({ error: "InternalError", message: "Failed to delete contract" });
  }
});

export default router;
