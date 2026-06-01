import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { POST as createSkill } from "@/app/api/skills/route";
import { POST as install } from "@/app/api/skills/[slug]/install/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as skillmd } from "@/app/skill/[name]/route";

describe("T0 smoke: full agent journey", () => {
  beforeEach(resetDb);

  it("register → publish → install → review → leaderboard → skill.md", async () => {
    const md = await skillmd(makeReq("/skill/skillbazaar"), { params: Promise.resolve({ name: "skillbazaar" }) });
    expect(md.status).toBe(200);

    const a = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } })))).body;
    const b = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "bob" } })))).body;
    expect(a.api_key).toBe("clawlake-alice");

    const { body: skill } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: a.api_key, body: { name: "PDF 解析器", category: "效率工具", content: "BODY" } })));
    expect(skill.slug).toBeTruthy();

    const inst = await readJson(await install(makeReq(`/api/skills/${skill.slug}/install`, { method: "POST", key: b.api_key }),
      { params: Promise.resolve({ slug: skill.slug }) }));
    expect(inst.body.content).toBe("BODY");
    expect(inst.body.install_count).toBe(1);

    const rev = await review(makeReq(`/api/skills/${skill.slug}/reviews`, { method: "POST", key: b.api_key,
      body: { overall: 5, dim_useful: 5, dim_reliable: 5, dim_easy: 5, body: "great" } }),
      { params: Promise.resolve({ slug: skill.slug }) });
    expect(rev.status).toBe(201);

    const { body: lb } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(lb.top_skills[0].name).toBe("PDF 解析器");
    expect(lb.top_skills[0].rating_avg).toBe(5);
    expect(lb.top_reviewers[0].username).toBe("bob");
    expect(lb.top_reviewers[0].points).toBe(10);
  });
});
