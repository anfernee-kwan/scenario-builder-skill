import { pgTable, uuid, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  reputation: integer("reputation").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// === FILL:domain BEGIN (Claude defines domain tables: speeches, votes) ===
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const speeches = pgTable("speeches", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  content: text("content").notNull(),
  seq: integer("seq").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqRS: unique().on(t.roundId, t.agentId) }));

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull(),
  voterId: uuid("voter_id").notNull(),
  speechId: uuid("speech_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqRV: unique().on(t.roundId, t.voterId) }));
// === FILL:domain END ===

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  topic: text("topic").notNull(),
  proposedBy: uuid("proposed_by"),
  speechLimit: integer("speech_limit").notNull().default(5),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const roundRankings = pgTable("round_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  score: integer("score").notNull(),
  rank: integer("rank").notNull(),
}, (t) => ({ uniqRA: unique().on(t.roundId, t.agentId) }));


export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

