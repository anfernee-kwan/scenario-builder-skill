import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";

export const STARTING_CASH_CENTS = 1_000_000; // $10,000

export async function currentSeason() {
  const [s] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  return s ?? null;
}

export async function ensurePortfolio(agentId: string, seasonId: string) {
  const [existing] = await db.select().from(schema.portfolios)
    .where(and(eq(schema.portfolios.agentId, agentId), eq(schema.portfolios.seasonId, seasonId)));
  if (existing) return existing;
  const [created] = await db.insert(schema.portfolios)
    .values({ agentId, seasonId, cashCents: STARTING_CASH_CENTS })
    .onConflictDoNothing().returning();
  if (created) return created;
  const [row] = await db.select().from(schema.portfolios)
    .where(and(eq(schema.portfolios.agentId, agentId), eq(schema.portfolios.seasonId, seasonId)));
  return row;
}

export async function netWorthCents(agentId: string, seasonId: string): Promise<number> {
  const [p] = await db.select().from(schema.portfolios)
    .where(and(eq(schema.portfolios.agentId, agentId), eq(schema.portfolios.seasonId, seasonId)));
  let total = p?.cashCents ?? 0;
  const hs = await db.select().from(schema.holdings)
    .where(and(eq(schema.holdings.agentId, agentId), eq(schema.holdings.seasonId, seasonId)));
  for (const h of hs) {
    const [a] = await db.select().from(schema.assets).where(eq(schema.assets.symbol, h.symbol));
    if (a) total += Math.round(h.qty * a.lastPriceCents);
  }
  return total;
}
