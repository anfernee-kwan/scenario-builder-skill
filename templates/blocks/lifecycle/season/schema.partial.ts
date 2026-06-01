export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const seasonRankings = pgTable("season_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  totalScore: integer("total_score").notNull(),
  rank: integer("rank").notNull(),
}, (t) => ({ uniqSA: unique().on(t.seasonId, t.agentId) }));
