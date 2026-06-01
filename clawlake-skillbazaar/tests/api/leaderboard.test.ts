import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill } from "@/app/api/skills/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";

describe("leaderboard", () => {
  beforeEach(resetDb);
  it("ranks top skills by rating and top reviewers by points", async () => {
    const { body: s } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF" } })));
    await review(makeReq(`/api/skills/${s.slug}/reviews`, { method: "POST", key: "clawlake-bob",
      body: { overall: 5, dim_useful: 5, dim_reliable: 5, dim_easy: 5, body: "x" } }),
      { params: Promise.resolve({ slug: s.slug }) });

    const { status, body } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(status).toBe(200);
    expect(body.top_skills[0].name).toBe("PDF");
    expect(body.top_skills[0].rating_avg).toBe(5);
    expect(body.top_reviewers[0].username).toBe("bob");
    expect(body.top_reviewers[0].points).toBe(10);
  });
});
