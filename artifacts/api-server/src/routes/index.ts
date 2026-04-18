import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import contractsRouter from "./contracts.js";
import analysisRouter from "./analysis.js";
import chatRouter from "./chat.js";
import paymentsRouter from "./payments.js";
import dashboardRouter from "./dashboard.js";
import referralsRouter from "./referrals.js";
import supportRouter from "./support.js";
import aiRouter from "./ai.js";
import extrasRouter from "./extras.js";
import auditRouter from "./audit.js";
import biometricRouter from "./biometric.js";
import teamsRouter from "./teams.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/contracts", contractsRouter);
router.use("/contracts", analysisRouter);
router.use("/chat", chatRouter);
router.use("/payments", paymentsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/referrals", referralsRouter);
router.use("/support", supportRouter);
router.use("/ai", aiRouter);
router.use("/audit", auditRouter);
router.use("/biometric", biometricRouter);
router.use("/teams", teamsRouter);
router.use(extrasRouter);

export default router;
