import { Router } from "express";
import type { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, usersTable, biometricCredentialsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();

function structuredError(source: string, message: string, details: string) {
  return { error: true, message, details, source };
}

function rpInfo(req: Request): { rpID: string; origin: string } {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
  const proto = String(req.headers["x-forwarded-proto"] ?? "https").split(",")[0]?.trim() ?? "https";
  const rpID = host.split(":")[0] ?? "localhost";
  const origin = `${proto}://${host}`;
  return { rpID, origin };
}

// In-memory challenge store keyed by userId or email (5-minute TTL)
type ChallengeEntry = { challenge: string; expiresAt: number; userId?: string; email?: string };
const challenges = new Map<string, ChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function setChallenge(key: string, entry: Omit<ChallengeEntry, "expiresAt">): void {
  challenges.set(key, { ...entry, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  // Best-effort cleanup
  if (challenges.size > 500) {
    const now = Date.now();
    for (const [k, v] of challenges) if (v.expiresAt < now) challenges.delete(k);
  }
}

function takeChallenge(key: string): ChallengeEntry | null {
  const e = challenges.get(key);
  if (!e) return null;
  challenges.delete(key);
  if (e.expiresAt < Date.now()) return null;
  return e;
}

// =====================================================
// REGISTRATION (logged in user adds a biometric credential)
// =====================================================
router.post("/register/options", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { rpID } = rpInfo(req);
    const userId = req.userId!;
    const userEmail = req.userEmail ?? "user@contractai.app";

    const existing = await db.select({ credentialId: biometricCredentialsTable.credentialId, transports: biometricCredentialsTable.transports })
      .from(biometricCredentialsTable)
      .where(eq(biometricCredentialsTable.userId, userId));

    const options = await generateRegistrationOptions({
      rpName: "ContractAI",
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: userEmail,
      userDisplayName: userEmail,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      })),
    });

    setChallenge(`reg:${userId}`, { challenge: options.challenge, userId });
    res.json(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "BIOMETRIC", details: msg }, "Biometric: register options failed");
    res.status(500).json(structuredError("BIOMETRIC", "Could not start biometric registration", msg));
  }
});

router.post("/register/verify", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { rpID, origin } = rpInfo(req);
    const { response, deviceLabel } = req.body as { response: RegistrationResponseJSON; deviceLabel?: string };

    const stored = takeChallenge(`reg:${userId}`);
    if (!stored) {
      res.status(400).json(structuredError("BIOMETRIC", "Registration session expired — please try again", "challenge missing or expired"));
      return;
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json(structuredError("BIOMETRIC", "Biometric registration verification failed", "verifier returned not verified"));
      return;
    }

    const { credential } = verification.registrationInfo;
    const credentialIdB64 = credential.id;
    const publicKeyB64 = Buffer.from(credential.publicKey).toString("base64url");

    await db.insert(biometricCredentialsTable).values({
      id: uuidv4(),
      userId,
      credentialId: credentialIdB64,
      publicKey: publicKeyB64,
      counter: credential.counter,
      transports: response.response.transports ?? [],
      deviceLabel: deviceLabel?.slice(0, 100) ?? "Device",
    });

    req.log.info({ source: "BIOMETRIC", userId }, "Biometric: credential registered");
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "BIOMETRIC", details: msg }, "Biometric: register verify failed");
    res.status(500).json(structuredError("BIOMETRIC", "Could not complete biometric registration", msg));
  }
});

router.get("/credentials", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await db.select({
      id: biometricCredentialsTable.id,
      deviceLabel: biometricCredentialsTable.deviceLabel,
      createdAt: biometricCredentialsTable.createdAt,
      lastUsedAt: biometricCredentialsTable.lastUsedAt,
    }).from(biometricCredentialsTable).where(eq(biometricCredentialsTable.userId, req.userId!));
    res.json({ credentials: rows });
  } catch (err) {
    res.status(500).json(structuredError("BIOMETRIC", "Could not load credentials", err instanceof Error ? err.message : String(err)));
  }
});

router.delete("/credentials/:credId", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { credId } = req.params as { credId: string };
    await db.delete(biometricCredentialsTable)
      .where(and(eq(biometricCredentialsTable.id, credId), eq(biometricCredentialsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(structuredError("BIOMETRIC", "Could not delete credential", err instanceof Error ? err.message : String(err)));
  }
});

// =====================================================
// LOGIN (no auth required)
// =====================================================
router.post("/login/options", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) {
      res.status(400).json(structuredError("BIOMETRIC", "Email is required", "missing email"));
      return;
    }
    const { rpID } = rpInfo(req);

    const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase())).limit(1);
    const user = userRows[0];

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
    if (user) {
      const creds = await db.select().from(biometricCredentialsTable).where(eq(biometricCredentialsTable.userId, user.id));
      allowCredentials = creds.map((c) => ({
        id: c.credentialId,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    setChallenge(`auth:${email.trim().toLowerCase()}`, { challenge: options.challenge, email: email.trim().toLowerCase() });
    res.json(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "BIOMETRIC", details: msg }, "Biometric: login options failed");
    res.status(500).json(structuredError("BIOMETRIC", "Could not start biometric login", msg));
  }
});

router.post("/login/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, response } = req.body as { email?: string; response: AuthenticationResponseJSON };
    if (!email?.trim() || !response) {
      res.status(400).json(structuredError("BIOMETRIC", "Email and response required", "missing fields"));
      return;
    }
    const { rpID, origin } = rpInfo(req);

    const stored = takeChallenge(`auth:${email.trim().toLowerCase()}`);
    if (!stored) {
      res.status(400).json(structuredError("BIOMETRIC", "Login session expired — please try again", "challenge missing"));
      return;
    }

    const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase())).limit(1);
    const user = userRows[0];
    if (!user) {
      res.status(404).json(structuredError("BIOMETRIC", "No account found with this email", "user missing"));
      return;
    }

    const credRows = await db.select().from(biometricCredentialsTable)
      .where(and(eq(biometricCredentialsTable.userId, user.id), eq(biometricCredentialsTable.credentialId, response.id)))
      .limit(1);
    const cred = credRows[0];
    if (!cred) {
      res.status(401).json(structuredError("BIOMETRIC", "This device is not registered for biometric login", "credential not found"));
      return;
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: (cred.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      res.status(401).json(structuredError("BIOMETRIC", "Biometric verification failed", "signature invalid"));
      return;
    }

    await db.update(biometricCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(biometricCredentialsTable.id, cred.id));

    // Issue a Supabase magic-link / session via admin: generate a magic link and exchange immediately client-side is heavy.
    // Instead, generate a Supabase session by signing in via admin.generateLink and returning the access tokens.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      req.log.error({ source: "BIOMETRIC", details: linkErr?.message ?? "no token" }, "Biometric: failed to generate session");
      res.status(500).json(structuredError("BIOMETRIC", "Authentication succeeded but session creation failed", linkErr?.message ?? "no token"));
      return;
    }

    // Verify the OTP/hashed_token to obtain a real session for the user
    const { data: sessionData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
      type: "magiclink",
      email: user.email,
      token_hash: linkData.properties.hashed_token,
    });

    if (verifyErr || !sessionData?.session) {
      req.log.error({ source: "BIOMETRIC", details: verifyErr?.message ?? "no session" }, "Biometric: failed to verify OTP");
      res.status(500).json(structuredError("BIOMETRIC", "Authentication succeeded but session exchange failed", verifyErr?.message ?? "no session"));
      return;
    }

    res.cookie("sb-session", sessionData.session.access_token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    req.log.info({ source: "BIOMETRIC", userId: user.id }, "Biometric: login successful");
    res.json({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ error: true, source: "BIOMETRIC", details: msg }, "Biometric: login verify failed");
    res.status(500).json(structuredError("BIOMETRIC", "Biometric login failed", msg));
  }
});

// Bulk delete (used by password change handler)
router.delete("/all", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db.delete(biometricCredentialsTable).where(eq(biometricCredentialsTable.userId, req.userId!));
    req.log.info({ source: "BIOMETRIC", userId: req.userId }, "Biometric: all credentials revoked");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json(structuredError("BIOMETRIC", "Could not revoke credentials", err instanceof Error ? err.message : String(err)));
  }
});

export default router;
