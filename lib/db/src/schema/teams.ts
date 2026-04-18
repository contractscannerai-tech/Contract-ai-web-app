import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const teamRoleEnum = pgEnum("team_role", ["owner", "member"]);

export const teamsTable = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  scansUsed: integer("scans_used").notNull().default(0),
  scansLimit: integer("scans_limit").notNull().default(50),
  scansResetAt: timestamp("scans_reset_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembersTable = pgTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  userId: text("user_id").notNull(),
  role: teamRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamInvitesTable = pgTable("team_invites", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  teamId: text("team_id").notNull(),
  email: text("email").notNull(),
  invitedBy: text("invited_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Team = typeof teamsTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
export type TeamInvite = typeof teamInvitesTable.$inferSelect;
