import { Router } from "express";
import type { Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: 999,
};

router.post("/signup", async (req, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Email and password required" });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      res.status(400).json({ error: "SignupError", message: error.message });
      return;
    }

    if (data.user) {
      try {
        await db.insert(usersTable).values({
          id: data.user.id,
          email: data.user.email ?? email,
          plan: "free",
          contractsUsed: 0,
        }).onConflictDoNothing();
      } catch (dbErr) {
        req.log.warn({ dbErr }, "Failed to insert user record after signup");
      }
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (sessionError) {
      req.log.warn({ sessionError }, "Could not generate session for new user");
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      res.status(200).json({ success: true, message: "Account created. Please log in." });
      return;
    }

    res.cookie("sb-session", signInData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, token: signInData.session.access_token });
  } catch (err) {
    req.log.error({ err }, "Signup error");
    res.status(500).json({ error: "InternalError", message: "Signup failed" });
  }
});

router.post("/login", async (req, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Email and password required" });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      res.status(401).json({ error: "AuthError", message: error?.message ?? "Invalid credentials" });
      return;
    }

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.id, data.user.id)).limit(1);
    if (dbUser.length === 0) {
      await db.insert(usersTable).values({
        id: data.user.id,
        email: data.user.email ?? email,
        plan: "free",
        contractsUsed: 0,
      }).onConflictDoNothing();
      dbUser = await db.select().from(usersTable).where(eq(usersTable.id, data.user.id)).limit(1);
    }

    res.cookie("sb-session", data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, token: data.session.access_token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "InternalError", message: "Login failed" });
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      plan: user.plan,
      contractsUsed: user.contractsUsed,
      contractsLimit: PLAN_LIMITS[user.plan] ?? 3,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "InternalError", message: "Failed to get user info" });
  }
});

router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.["sb-session"];
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
    res.clearCookie("sb-session");
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.clearCookie("sb-session");
    res.json({ success: true, message: "Logged out" });
  }
});

export default router;
