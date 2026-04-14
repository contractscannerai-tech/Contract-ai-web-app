import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { generalLimiter } from "./lib/rate-limit.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser(process.env["SESSION_SECRET"]));

app.use("/api/payments/webhook", express.raw({ type: "*/*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.use("/api", router);

// ─── Production static file serving ────────────────────────────────────────
// In production the React SPA is built into artifacts/contract-ai/dist/public.
// The Express server serves those assets so the whole app runs on a single port
// (8080), which is required for Autoscale/Cloud Run deployments.
if (process.env["NODE_ENV"] === "production") {
  const publicDir = path.resolve(process.cwd(), "artifacts/contract-ai/dist/public");

  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(publicDir, { index: false }));

  // SPA fallback — all non-API routes serve index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
