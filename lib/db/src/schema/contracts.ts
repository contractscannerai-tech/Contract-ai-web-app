import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractStatusEnum = pgEnum("contract_status", [
  "uploaded",
  "extracting",
  "extracted",
  "analyzing",
  "analyzed",
  "failed",
]);

export const contractsTable = pgTable("contracts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  status: contractStatusEnum("status").notNull().default("uploaded"),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  createdAt: true,
  analyzedAt: true,
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
