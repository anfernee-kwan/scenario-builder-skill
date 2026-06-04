export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  topic: text("topic").notNull(),
  proposedBy: uuid("proposed_by").notNull(),
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
