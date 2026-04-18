import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export type AuditMetadata = {
  riskScore?: number;
  riskCategory?: string;
  contractType?: string | null;
  filename?: string;
  contractId?: string;
};

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  contractId: text("contract_id"),
  riskScore: integer("risk_score"),
  contractType: text("contract_type"),
  metadata: jsonb("metadata").$type<AuditMetadata>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
