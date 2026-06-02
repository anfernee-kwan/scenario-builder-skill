import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";
import { uuidFromString } from "@/lib/ids";
import { STARTING_CASH_CENTS, ensurePortfolio, netWorthCents, currentSeason } from "@/lib/portfolio";

async function seedSeason() {
  const [s] = await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" }).returning();
  return s;
}

describe("portfolio", () => {
  beforeEach(resetDb);

  it("ensurePortfolio credits starting cash once (idempotent)", async () => {
    const s = await seedSeason();
    const agent = uuidFromString("alice");
    const p1 = await ensurePortfolio(agent, s.id);
    expect(p1.cashCents).toBe(STARTING_CASH_CENTS);
    const p2 = await ensurePortfolio(agent, s.id);
    expect(p2.id).toBe(p1.id);
    expect((await db.select().from(schema.portfolios)).length).toBe(1);
  });

  it("netWorthCents = cash + sum(qty * last_price)", async () => {
    const s = await seedSeason();
    const agent = uuidFromString("bob");
    const p = await ensurePortfolio(agent, s.id); // starts at STARTING_CASH_CENTS
    await db.insert(schema.assets).values({ symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 100000 });
    await db.insert(schema.holdings).values({ agentId: agent, seasonId: s.id, symbol: "BTC", qty: 2 });
    const nw = await netWorthCents(agent, s.id);
    expect(nw).toBe(p.cashCents + 2 * 100000);
  });

  it("currentSeason returns the open season or null", async () => {
    expect(await currentSeason()).toBeNull();
    const s = await seedSeason();
    expect((await currentSeason())?.id).toBe(s.id);
  });
});
