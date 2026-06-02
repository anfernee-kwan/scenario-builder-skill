import { db, schema } from "@/db/client";
import { and, eq, lte, or } from "drizzle-orm";
import { fetchPrices } from "@/blocks/prices";
import { netWorthCents } from "@/lib/portfolio";
import { publishRanks } from "@/blocks/identity-publish";

let tickIndex = 0;

async function rankSeason(seasonId: string) {
  const ps = await db.select().from(schema.portfolios).where(eq(schema.portfolios.seasonId, seasonId));
  const scored: { agentId: string; totalScore: number }[] = [];
  for (const p of ps) scored.push({ agentId: p.agentId, totalScore: await netWorthCents(p.agentId, seasonId) });
  scored.sort((a, b) => b.totalScore - a.totalScore);
  const ranks = scored.map((r, i) => ({ ...r, rank: i + 1 }));
  await db.transaction(async (tx) => {
    for (const r of ranks) {
      await tx.insert(schema.seasonRankings).values({ seasonId, agentId: r.agentId, totalScore: r.totalScore, rank: r.rank })
        .onConflictDoUpdate({ target: [schema.seasonRankings.seasonId, schema.seasonRankings.agentId], set: { totalScore: r.totalScore, rank: r.rank } });
    }
  });
  return ranks;
}

export async function tickOnce(now: Date = new Date()): Promise<{ pricesUpdated: number; archivedSeasons: number }> {
  const tick = tickIndex++;
  // 1) refresh prices
  const assets = await db.select().from(schema.assets);
  let pricesUpdated = 0;
  if (assets.length) {
    try {
      const prices = await fetchPrices(assets.map((a) => ({ symbol: a.symbol, coingeckoId: a.coingeckoId })), tick);
      for (const a of assets) {
        if (typeof prices[a.symbol] === "number") {
          await db.update(schema.assets).set({ lastPriceCents: prices[a.symbol], priceUpdatedAt: now }).where(eq(schema.assets.symbol, a.symbol));
          pricesUpdated++;
        }
      }
    } catch (e) { console.error("[engine] price fetch failed, keeping stale", e); }
  }

  // 2) recompute rankings for open seasons
  const open = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open"));
  for (const s of open) await rankSeason(s.id);

  // 3) archive due/closed seasons
  const due = await db.select().from(schema.seasons)
    .where(or(eq(schema.seasons.status, "closed"), and(eq(schema.seasons.status, "open"), lte(schema.seasons.closedAt, now))));
  let archivedSeasons = 0;
  for (const s of due) {
    const ranks = await rankSeason(s.id);
    await db.update(schema.seasons).set({ status: "archived", closedAt: s.closedAt ?? now }).where(eq(schema.seasons.id, s.id));
    await publishRanks(s.id, ranks);
    archivedSeasons++;
  }
  return { pricesUpdated, archivedSeasons };
}
