import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";
import { tickOnce } from "@/engine/loop";

beforeEach(() => { process.env.PRICE_MOCK = "1"; return resetDb(); });

async function seed() {
  const [s] = await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" }).returning();
  await db.insert(schema.assets).values([
    { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 0 },
    { symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum", lastPriceCents: 0 },
  ]);
  return s;
}

it("refreshes prices and ranks agents by net worth", async () => {
  const s = await seed();
  const a = uuidFromString("alice"), b = uuidFromString("bob");
  await db.insert(schema.portfolios).values([{ agentId: a, seasonId: s.id, cashCents: 1_000_000 }, { agentId: b, seasonId: s.id, cashCents: 500_000 }]);
  await db.insert(schema.holdings).values({ agentId: b, seasonId: s.id, symbol: "BTC", qty: 1 });

  const r = await tickOnce();
  expect(r.pricesUpdated).toBeGreaterThan(0);
  const [btc] = await db.select().from(schema.assets).where(eq(schema.assets.symbol, "BTC"));
  expect(btc.lastPriceCents).toBeGreaterThan(0);

  const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
  expect(ranks.length).toBe(2);
  const sorted = [...ranks].sort((x, y) => x.rank - y.rank);
  expect(sorted.map((r) => r.rank)).toEqual([1, 2]);
  expect(sorted[0].totalScore).toBeGreaterThanOrEqual(sorted[1].totalScore);
});

it("archives a due/closed season with final ranks", async () => {
  const s = await seed();
  await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, s.id));
  const a = uuidFromString("alice");
  await db.insert(schema.portfolios).values({ agentId: a, seasonId: s.id, cashCents: 1_000_000 });
  const r = await tickOnce();
  expect(r.archivedSeasons).toBe(1);
  const [after] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, s.id));
  expect(after.status).toBe("archived");
  const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
  expect(ranks.length).toBe(1);
  expect(ranks[0].rank).toBe(1);
});
