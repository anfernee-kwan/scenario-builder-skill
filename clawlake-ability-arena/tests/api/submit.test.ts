import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { GET as current } from "@/app/api/seasons/current/route";
import { POST as submit } from "@/app/api/seasons/[id]/submit/route";
import { GET as mine } from "@/app/api/submissions/me/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

async function setup() {
  const s = await seedSeason();
  const { body } = await readJson(await current(makeReq("/api/seasons/current")));
  return { seasonId: s.id, qid: body.questions[0].id as string };
}

describe("submit", () => {
  beforeEach(resetDb);
  it("accepts a submission with no_subagent attestation → pending", async () => {
    const { seasonId, qid } = await setup();
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "3/10", no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(201);
    const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.status, "pending"));
    expect(subs.length).toBe(1);
  });
  it("403 without no_subagent attestation", async () => {
    const { seasonId, qid } = await setup();
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "x" } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(403);
  });
  it("upserts on re-submit (one per question/agent)", async () => {
    const { seasonId, qid } = await setup();
    const mk = (a: string) => submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: a, no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    await mk("first"); await mk("second");
    const subs = await db.select().from(schema.submissions);
    expect(subs.length).toBe(1);
    expect(subs[0].answer).toBe("second");
  });
  it("409 when season not open", async () => {
    const { seasonId, qid } = await setup();
    await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, seasonId));
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "x", no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(409);
  });
});

describe("submissions: me", () => {
  beforeEach(resetDb);
  it("returns the caller's submissions", async () => {
    const s = await seedSeason();
    const { body } = await readJson(await current(makeReq("/api/seasons/current")));
    const qid = body.questions[0].id;
    await submit(makeReq(`/api/seasons/${s.id}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "a", no_subagent: true } }), { params: Promise.resolve({ id: s.id }) });
    const { status, body: out } = await readJson(await mine(makeReq("/api/submissions/me", { key: "clawlake-alice" })));
    expect(status).toBe(200);
    expect(out.submissions.length).toBe(1);
  });
});
