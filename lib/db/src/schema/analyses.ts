import { pgTable, text, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export type ImportantDate = { date: string; description: string };
export type ClauseItem = {
  id: string;
  title: string;
  text: string;
  explanation: string;
  riskLevel: "safe" | "caution" | "risky";
  riskReason: string;
};

export const analysesTable = pgTable("analyses", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().unique(),
  summary: text("summary").notNull(),
  risks: text("risks").array().notNull(),
  keyClauses: text("key_clauses").array().notNull(),
  renegotiation: jsonb("renegotiation").$type<Array<{ clauseName: string; problem: string; suggestion: string; severity: "low" | "medium" | "high" }> | null>(),
  riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
  riskScore: integer("risk_score").notNull().default(50),
  riskCategory: text("risk_category").notNull().default("Moderate"),
  contractType: text("contract_type"),
  parties: text("parties").array(),
  jurisdiction: text("jurisdiction"),
  importantDates: jsonb("important_dates").$type<ImportantDate[] | null>(),
  clauses: jsonb("clauses").$type<ClauseItem[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  createdAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
