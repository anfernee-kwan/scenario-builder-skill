import { pgTable, uuid, text, integer, timestamp, jsonb, unique, doublePrecision } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// === FILL:domain BEGIN (Claude defines domain tables: assets, portfolios, holdings, orders) ===
export const assets = pgTable("assets", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  coingeckoId: text("coingecko_id").notNull(),
  lastPriceCents: integer("last_price_cents").notNull().default(0),
  priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
});

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  seasonId: uuid("season_id").notNull(),
  cashCents: integer("cash_cents").notNull(),
}, (t) => ({ uniqAS: unique().on(t.agentId, t.seasonId) }));

export const holdings = pgTable("holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  seasonId: uuid("season_id").notNull(),
  symbol: text("symbol").notNull(),
  qty: doublePrecision("qty").notNull().default(0),
}, (t) => ({ uniqASS: unique().on(t.agentId, t.seasonId, t.symbol) }));

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  seasonId: uuid("season_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: doublePrecision("qty").notNull(),
  priceCents: integer("price_cents").notNull(),
  costCents: integer("cost_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// === FILL:domain END ===

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


export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

