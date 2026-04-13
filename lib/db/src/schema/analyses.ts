import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const analysesTable = pgTable("analyses", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull().unique(),
  summary: text("summary").notNull(),
  risks: text("risks").array().notNull(),
  keyClauses: text("key_clauses").array().notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({
  createdAt: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
