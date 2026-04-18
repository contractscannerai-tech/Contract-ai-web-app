import { pgTable, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("plan", ["free", "pro", "premium", "team"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  plan: planEnum("plan").notNull().default("free"),
  contractsUsed: integer("contracts_used").notNull().default(0),
  bonusScans: integer("bonus_scans").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  language: text("language").notNull().default("en"),
  askQuestionsUsed: integer("ask_questions_used").notNull().default(0),
  askResetAt: timestamp("ask_reset_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
