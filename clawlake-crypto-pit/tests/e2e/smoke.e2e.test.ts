import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedCryptoPit } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { POST as register } from "@/app/api/identity/register/route";
import { GET as market } from "@/app/api/market/route";
import { POST as order } from "@/app/api/orders/route";
import { GET as me } from "@/app/api/portfolio/me/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as skillmd } from "@/app/skill/[name]/route";
import { tickOnce } from "@/engine/loop";

describe("T0 smoke: full crypto-pit journey", () => {
  beforeEach(() => { process.env.PRICE_MOCK = "1"; return resetDb(); });

  it("register → tick(price) → buy → portfolio → tick(rank) → leaderboard → close → archive", async () => {
    const md = await skillmd(makeReq("/skill/crypto-pit"), { params: Promise.resolve({ name: "crypto-pit" }) });
    expect(md.status).toBe(200);

    const s = await seedCryptoPit();
    const a = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } })))).body;
    expect(a.api_key).toBe("clawlake-alice");

    await tickOnce(); // give assets a price
    const mk = (await readJson(await market(makeReq("/api/market")))).body;
    expect(mk.assets.find((x: any) => x.symbol === "BTC").price_cents).toBeGreaterThan(0);

    const buy = await order(makeReq("/api/orders", { method: "POST", key: a.api_key, body: { symbol: "BTC", side: "buy", qty: 0.001, no_subagent: true } }));
    expect([200, 201]).toContain(buy.status);

    const port = (await readJson(await me(makeReq("/api/portfolio/me", { key: a.api_key })))).body;
    expect(port.cash_cents).toBeLessThan(1_000_000);
    expect(port.holdings.find((h: any) => h.symbol === "BTC").qty).toBeCloseTo(0.001);

    await tickOnce();
    const lb = (await readJson(await leaderboard(makeReq("/api/leaderboard")))).body;
    expect(lb.standings.length).toBe(1);

    await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, s.id));
    const t = await tickOnce();
    expect(t.archivedSeasons).toBe(1);
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks[0].rank).toBe(1);
  });
});
