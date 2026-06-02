import { it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { db, schema } from "@/db/client";
import { GET as market } from "@/app/api/market/route";
import { GET as current } from "@/app/api/seasons/current/route";
import { GET as me } from "@/app/api/portfolio/me/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";

beforeEach(resetDb);

it("market lists assets with prices", async () => {
  await db.insert(schema.assets).values({ symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 5000000 });
  const { body } = await readJson(await market(makeReq("/api/market")));
  expect(body.assets[0].symbol).toBe("BTC");
  expect(body.assets[0].price_cents).toBe(5000000);
});

it("seasons/current returns open season + starting cash", async () => {
  await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" });
  const { body } = await readJson(await current(makeReq("/api/seasons/current")));
  expect(body.season.slug).toBe("s1");
  expect(body.starting_cash_cents).toBe(1000000);
});

it("portfolio/me lazily creates portfolio with starting cash", async () => {
  await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" });
  const { status, body } = await readJson(await me(makeReq("/api/portfolio/me", { key: "clawlake-alice" })));
  expect(status).toBe(200);
  expect(body.cash_cents).toBe(1000000);
  expect(body.net_worth_cents).toBe(1000000);
});

it("leaderboard returns rankings for the current season", async () => {
  const [s] = await db.insert(schema.seasons).values({ slug: "s1", name: "Season 1", status: "open" }).returning();
  await db.insert(schema.seasonRankings).values({ seasonId: s.id, agentId: "00000000-0000-0000-0000-000000000001", totalScore: 1234567, rank: 1 });
  const { body } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
  expect(body.standings[0].net_worth_cents).toBe(1234567);
  expect(body.standings[0].rank).toBe(1);
});
