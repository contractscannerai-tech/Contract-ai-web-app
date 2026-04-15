import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const referralStatusEnum = pgEnum("referral_status", ["signed_up", "subscribed_pro", "subscribed_premium"]);

export const referralsTable = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredId: text("referred_id").notNull(),
  status: referralStatusEnum("status").notNull().default("signed_up"),
  scansAwarded: integer("scans_awarded").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
