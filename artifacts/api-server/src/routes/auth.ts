import { Router } from "express";
import type { Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { db, usersTable, contractsTable, analysesTable, chatMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  premium: 999,
};

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

router.post("/signup", async (req, res: Response): Promise<void> => {
  const { email, password, termsAccepted } = req.body as { email?: string; password?: string; termsAccepted?: boolean };
  if (!email || !password) {
    res.status(400).json(structuredError("AUTH", "Email and password are required", "Missing email or password field in request body"));
    return;
  }

  // LEGAL COMPLIANCE: Terms of Service acceptance is mandatory before account creation
  if (termsAccepted !== true) {
    res.status(400).json(structuredError("AUTH", "You must accept the Terms of Service before creating an account.", "termsAccepted must be true"));
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      req.log.error({
        error: true,
        source: "AUTH",
        message: "Supabase user creation failed during signup",
        details: error.message,
        email,
      }, "Signup: Supabase admin createUser error");
      res.status(400).json(structuredError("AUTH", error.message, `Supabase error code: ${error.status ?? "unknown"}`));
      return;
    }

    if (data.user) {
      try {
        await db.insert(usersTable).values({
          id: data.user.id,
          email: data.user.email ?? email,
          plan: "free",
          contractsUsed: 0,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
        }).onConflictDoNothing();
      } catch (dbErr) {
        req.log.warn({
          error: true,
          source: "SYSTEM",
          message: "Failed to insert user record into DB after signup",
          details: dbErr instanceof Error ? dbErr.message : String(dbErr),
          userId: data.user.id,
        }, "Signup: DB insert failed (non-fatal)");
      }
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      req.log.warn({
        error: true,
        source: "AUTH",
        message: "User created but auto-login failed",
        details: signInError?.message ?? "No session returned from signInWithPassword",
        email,
      }, "Signup: Auto-login after signup failed");
      res.status(200).json({ success: true, message: "Account created. Please log in." });
      return;
    }

    res.cookie("sb-session", signInData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.log.info({ source: "AUTH", userId: data.user?.id, email }, "Signup: success");
    res.json({ success: true, token: signInData.session.access_token });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Unexpected error during signup",
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      email,
    }, "Signup: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Signup failed due to an internal error", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/login", async (req, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json(structuredError("AUTH", "Email and password are required", "Missing email or password in request body"));
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      req.log.warn({
        error: true,
        source: "AUTH",
        message: "Login failed: invalid credentials or Supabase error",
        details: error?.message ?? "No session returned",
        email,
      }, "Login: authentication failed");
      res.status(401).json(structuredError("AUTH", error?.message ?? "Invalid email or password", `Supabase status: ${error?.status ?? "no session"}`));
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

    req.log.info({ source: "AUTH", userId: data.user.id, plan: dbUser[0]?.plan }, "Login: success");
    res.json({ success: true, token: data.session.access_token });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Unexpected error during login",
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      email,
    }, "Login: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Login failed due to an internal error", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/oauth-session", async (req, res: Response): Promise<void> => {
  const { access_token } = req.body as { access_token?: string };
  if (!access_token) {
    res.status(400).json(structuredError("AUTH", "access_token is required", "Missing access_token field in request body"));
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(access_token);

    if (error || !data.user) {
      req.log.warn({
        error: true,
        source: "AUTH",
        message: "OAuth session validation failed: invalid or expired access_token",
        details: error?.message ?? "getUser returned no user",
      }, "OAuth session: token invalid");
      res.status(401).json(structuredError("AUTH", "Invalid or expired access token", error?.message ?? "No user returned from Supabase"));
      return;
    }

    const { user } = data;

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (dbUser.length === 0) {
      await db.insert(usersTable).values({
        id: user.id,
        email: user.email ?? "",
        plan: "free",
        contractsUsed: 0,
      }).onConflictDoNothing();
      dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    }

    res.cookie("sb-session", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.log.info({ source: "AUTH", userId: user.id, email: user.email, provider: "google" }, "OAuth session: established successfully");
    res.json({ success: true });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Unexpected error while establishing OAuth session",
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }, "OAuth session: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Failed to establish OAuth session", err instanceof Error ? err.message : String(err)));
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(404).json(structuredError("AUTH", "User record not found in database", `userId: ${req.userId}`));
      return;
    }

    const baseLimit = PLAN_LIMITS[user.plan] ?? 3;
    res.json({
      id: user.id,
      email: user.email,
      plan: user.plan,
      contractsUsed: user.contractsUsed,
      bonusScans: user.bonusScans ?? 0,
      contractsLimit: baseLimit + (user.bonusScans ?? 0),
      referralCode: user.referralCode,
      termsAccepted: user.termsAccepted ?? false,
      language: user.language ?? "en",
      reviewPromptShown: user.reviewPromptShown ?? false,
      teamId: user.teamId ?? null,
      displayName: user.displayName ?? null,
      profession: user.profession ?? null,
      chatPersonalization: user.chatPersonalization ?? null,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Failed to retrieve current user from database",
      details: err instanceof Error ? err.message : String(err),
      userId: req.userId,
    }, "Get me: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Failed to get user info", err instanceof Error ? err.message : String(err)));
  }
});

const SUPPORTED_LANGS = new Set(["en", "es", "fr", "pt", "ar", "hi", "de", "zh"]);

router.patch("/me/language", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { language } = req.body as { language?: string };
  if (!language || !SUPPORTED_LANGS.has(language)) {
    res.status(400).json(structuredError("AUTH", "Unsupported language code", `Received: ${String(language)}`));
    return;
  }
  try {
    await db.update(usersTable).set({ language, updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
    req.log.info({ source: "AUTH", userId: req.userId, language }, "Language preference updated");
    res.json({ success: true, language });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Failed to update language preference",
      details: err instanceof Error ? err.message : String(err),
      userId: req.userId,
    }, "Update language: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Failed to update language", err instanceof Error ? err.message : String(err)));
  }
});

router.patch("/me/profile", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { displayName, profession, chatPersonalization } = req.body as {
    displayName?: string | null;
    profession?: string | null;
    chatPersonalization?: string | null;
  };

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (displayName !== undefined) {
    if (displayName !== null && displayName.length > 60) {
      res.status(400).json(structuredError("VALIDATION", "Name is too long (max 60 chars)", `length=${displayName.length}`));
      return;
    }
    update["displayName"] = displayName ? displayName.trim().slice(0, 60) : null;
  }
  if (profession !== undefined) {
    if (profession !== null && profession.length > 80) {
      res.status(400).json(structuredError("VALIDATION", "Profession is too long (max 80 chars)", `length=${profession.length}`));
      return;
    }
    update["profession"] = profession ? profession.trim().slice(0, 80) : null;
  }
  if (chatPersonalization !== undefined) {
    if (chatPersonalization !== null && chatPersonalization.length > 800) {
      res.status(400).json(structuredError("VALIDATION", "Memory note is too long (max 800 chars)", `length=${chatPersonalization.length}`));
      return;
    }
    update["chatPersonalization"] = chatPersonalization ? chatPersonalization.trim().slice(0, 800) : null;
  }

  try {
    await db.update(usersTable).set(update).where(eq(usersTable.id, req.userId!));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(structuredError("AUTH", "Failed to update profile", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/me/review-shown", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { submitted, rating, comment } = req.body as { submitted?: boolean; rating?: number | null; comment?: string | null };
  try {
    await db
      .update(usersTable)
      .set({ reviewPromptShown: true, updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));

    if (submitted && typeof rating === "number" && rating >= 1 && rating <= 5) {
      req.log.info({
        source: "REVIEW",
        userId: req.userId,
        rating,
        comment: comment ?? null,
      }, "User submitted in-app review");
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Failed to record review prompt",
      details: err instanceof Error ? err.message : String(err),
      userId: req.userId,
    }, "Review-shown error");
    res.status(500).json(structuredError("AUTH", "Failed to record review prompt", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/accept-terms", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db
      .update(usersTable)
      .set({ termsAccepted: true, termsAcceptedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ error: true, source: "AUTH", message: "Failed to accept terms", details: err instanceof Error ? err.message : String(err) }, "Accept terms error");
    res.status(500).json(structuredError("AUTH", "Failed to save terms acceptance", err instanceof Error ? err.message : String(err)));
  }
});

router.delete("/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    req.log.info({ source: "AUTH", userId }, "Delete account: starting full data purge");

    // 1. Delete all chat messages for this user
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));

    // 2. Fetch all contracts so we can delete their analyses
    const userContracts = await db
      .select({ id: contractsTable.id })
      .from(contractsTable)
      .where(eq(contractsTable.userId, userId));

    // 3. Delete analyses for each contract
    for (const c of userContracts) {
      await db.delete(analysesTable).where(eq(analysesTable.contractId, c.id));
    }

    // 4. Delete all contracts
    await db.delete(contractsTable).where(eq(contractsTable.userId, userId));

    // 5. Delete user row from our DB
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    // 6. Delete from Supabase Auth (revokes all sessions)
    const { error: supabaseErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (supabaseErr) {
      req.log.warn({
        error: true,
        source: "AUTH",
        message: "Supabase auth deletion failed — local data already purged",
        details: supabaseErr.message,
        userId,
      }, "Delete account: Supabase deleteUser error (non-fatal, local data cleared)");
    }

    res.clearCookie("sb-session");
    req.log.info({ source: "AUTH", userId }, "Delete account: all user data purged successfully");
    res.json({ success: true, message: "Account and all associated data deleted." });
  } catch (err) {
    req.log.error({
      error: true,
      source: "AUTH",
      message: "Failed to delete account",
      details: err instanceof Error ? err.message : String(err),
      userId,
    }, "Delete account: unhandled exception");
    res.status(500).json(structuredError("AUTH", "Account deletion failed — please try again or contact support", err instanceof Error ? err.message : String(err)));
  }
});

router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.["sb-session"];
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
    res.clearCookie("sb-session");
    req.log.info({ source: "AUTH", userId: req.userId }, "Logout: success");
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    req.log.warn({
      error: true,
      source: "AUTH",
      message: "Error during logout (session cleared anyway)",
      details: err instanceof Error ? err.message : String(err),
      userId: req.userId,
    }, "Logout: error during sign-out (non-fatal)");
    res.clearCookie("sb-session");
    res.json({ success: true, message: "Logged out" });
  }
});

export default router;
