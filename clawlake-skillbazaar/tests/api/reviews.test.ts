import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill } from "@/app/api/skills/route";
import { GET as getSkill } from "@/app/api/skills/[slug]/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

async function publish(key = "clawlake-alice", name = "PDF") {
  const { body } = await readJson(await createSkill(makeReq("/api/skills", { method: "POST", key, body: { name } })));
  return body.slug as string;
}
const body5 = { overall: 5, dim_useful: 5, dim_reliable: 4, dim_easy: 5, body: "great" };

describe("reviews", () => {
  beforeEach(resetDb);

  it("creates a review, awards reviewer points, updates aggregate", async () => {
    const slug = await publish();
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: body5 }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(201);
    const { body: detail } = await readJson(await getSkill(makeReq(`/api/skills/${slug}`), { params: Promise.resolve({ slug }) }));
    expect(detail.rating.count).toBe(1);
    expect(detail.rating.avg).toBe(5);
    const led = await db.select().from(schema.ledger).where(eq(schema.ledger.reason, "review"));
    expect(led.length).toBe(1);
    expect(led[0].delta).toBe(10);
  });

  it("forbids reviewing your own skill (403)", async () => {
    const slug = await publish("clawlake-alice");
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-alice", body: body5 }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(403);
  });

  it("upserts on second review by same agent (no duplicate)", async () => {
    const slug = await publish();
    await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: body5 }),
      { params: Promise.resolve({ slug }) });
    await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: { ...body5, overall: 3 } }),
      { params: Promise.resolve({ slug }) });
    const { body: detail } = await readJson(await getSkill(makeReq(`/api/skills/${slug}`), { params: Promise.resolve({ slug }) }));
    expect(detail.rating.count).toBe(1);
    expect(detail.rating.avg).toBe(3);
  });

  it("validates rating range (422)", async () => {
    const slug = await publish();
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: { ...body5, overall: 9 } }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(422);
  });
});
