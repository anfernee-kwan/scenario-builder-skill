import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { db, schema } from "@/db/client";
import { POST as order } from "@/app/api/orders/route";

async function setup() {
  const [s] = await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" }).returning();
  await db.insert(schema.assets).values({ symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 100000 }); // $1000
  return s;
}
const body = (b: object) => ({ method: "POST", key: "clawlake-alice", body: { no_subagent: true, ...b } });

describe("POST /api/orders", () => {
  beforeEach(resetDb);

  it("buys at last price, debits cash, adds holdings", async () => {
    await setup();
    const res = await readJson(await order(makeReq("/api/orders", body({ symbol: "BTC", side: "buy", qty: 2 }))));
    expect([200, 201]).toContain(res.status);
    const [p] = await db.select().from(schema.portfolios);
    expect(p.cashCents).toBe(1_000_000 - 2 * 100000); // 800000
    const [h] = await db.select().from(schema.holdings);
    expect(h.qty).toBe(2);
    const [o] = await db.select().from(schema.orders);
    expect(o.side).toBe("buy");
    const [l] = await db.select().from(schema.ledger);
    expect(l.delta).toBe(-200000);
  });

  it("sells back, credits cash, reduces holdings", async () => {
    await setup();
    await order(makeReq("/api/orders", body({ symbol: "BTC", side: "buy", qty: 2 })));
    const res = await order(makeReq("/api/orders", body({ symbol: "BTC", side: "sell", qty: 1 })));
    expect([200, 201]).toContain(res.status);
    const [p] = await db.select().from(schema.portfolios);
    expect(p.cashCents).toBe(1_000_000 - 2 * 100000 + 1 * 100000); // 900000
    const [h] = await db.select().from(schema.holdings);
    expect(h.qty).toBe(1);
  });

  it("rejects buy with insufficient cash (422)", async () => {
    await setup();
    expect((await order(makeReq("/api/orders", body({ symbol: "BTC", side: "buy", qty: 100 })))).status).toBe(422);
  });
  it("rejects sell with insufficient holdings (422)", async () => {
    await setup();
    expect((await order(makeReq("/api/orders", body({ symbol: "BTC", side: "sell", qty: 1 })))).status).toBe(422);
  });
  it("rejects missing no_subagent (403)", async () => {
    await setup();
    expect((await order(makeReq("/api/orders", { method: "POST", key: "clawlake-alice", body: { symbol: "BTC", side: "buy", qty: 1 } }))).status).toBe(403);
  });
  it("rejects when no open season (409)", async () => {
    await db.insert(schema.assets).values({ symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 100000 });
    expect((await order(makeReq("/api/orders", body({ symbol: "BTC", side: "buy", qty: 1 })))).status).toBe(409);
  });
  it("rejects unknown symbol / bad side / bad qty (422)", async () => {
    await setup();
    expect((await order(makeReq("/api/orders", body({ symbol: "DOGE", side: "buy", qty: 1 })))).status).toBe(422);
    expect((await order(makeReq("/api/orders", body({ symbol: "BTC", side: "hodl", qty: 1 })))).status).toBe(422);
    expect((await order(makeReq("/api/orders", body({ symbol: "BTC", side: "buy", qty: 0 })))).status).toBe(422);
  });
});
