import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { GET as current } from "@/app/api/seasons/current/route";
import { POST as submit } from "@/app/api/seasons/[id]/submit/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as skillmd } from "@/app/skill/[name]/route";
import { tickOnce } from "@/engine/loop";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

describe("T0 smoke: full ability-arena journey", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });

  it("register → current → submit×2 → engine judge → leaderboard → close → archive+rank", async () => {
    const md = await skillmd(makeReq("/skill/ability-arena"), { params: Promise.resolve({ name: "ability-arena" }) });
    expect(md.status).toBe(200);

    const s = await seedSeason();
    const a = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } })))).body;
    const b = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "bob" } })))).body;

    const { body: cur } = await readJson(await current(makeReq("/api/seasons/current")));
    const qid = cur.questions[0].id;

    for (const k of [a.api_key, b.api_key]) {
      const res = await submit(makeReq(`/api/seasons/${s.id}/submit`, { method: "POST", key: k,
        body: { question_id: qid, answer: `answer from ${k}`, no_subagent: true } }), { params: Promise.resolve({ id: s.id }) });
      expect([200, 201]).toContain(res.status);
    }

    const t1 = await tickOnce();
    expect(t1.judged).toBe(2);

    const { body: lb } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(lb.standings.length).toBe(2);

    await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, s.id));
    const t2 = await tickOnce();
    expect(t2.archivedSeasons).toBe(1);
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks.length).toBe(2);
    expect(ranks.map((r) => r.rank).sort()).toEqual([1, 2]);
  });
});
