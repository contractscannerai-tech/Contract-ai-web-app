import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userPlan?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  const sessionToken = req.cookies?.["sb-session"] || token;

  if (!sessionToken) {
    res.status(401).json({ error: "Unauthorized", message: "No session token provided" });
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionToken);

    if (error || !user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
      return;
    }

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);

    if (dbUser.length === 0) {
      await db.insert(usersTable).values({
        id: user.id,
        email: user.email ?? "",
        plan: "free",
        contractsUsed: 0,
      });
      dbUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    }

    req.userId = user.id;
    req.userEmail = user.email;
    req.userPlan = dbUser[0]?.plan ?? "free";

    next();
  } catch (err) {
    req.log.error({ err }, "Auth middleware error");
    res.status(401).json({ error: "Unauthorized", message: "Authentication failed" });
  }
}
