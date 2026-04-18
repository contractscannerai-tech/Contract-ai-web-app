import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const biometricCredentialsTable = pgTable("biometric_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports").array(),
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type BiometricCredential = typeof biometricCredentialsTable.$inferSelect;
