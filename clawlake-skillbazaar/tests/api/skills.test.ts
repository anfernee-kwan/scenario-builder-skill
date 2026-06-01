import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill, GET as listSkills } from "@/app/api/skills/route";
import { GET as getSkill } from "@/app/api/skills/[slug]/route";
import { POST as install } from "@/app/api/skills/[slug]/install/route";

describe("skills: publish", () => {
  beforeEach(resetDb);

  it("publishes a skill and returns it with a slug", async () => {
    const res = await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice",
      body: { name: "PDF 解析器", description: "解析 PDF", category: "效率工具", tags: ["pdf"], content: "# how to use" },
    }));
    const { status, body } = await readJson(res);
    expect(status).toBe(201);
    expect(body.slug).toBeTruthy();
    expect(body.name).toBe("PDF 解析器");
    expect(body.author.username).toBe("alice");
  });

  it("rejects missing name with 422", async () => {
    const res = await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-alice", body: { description: "x" } }));
    expect(res.status).toBe(422);
  });

  it("401 without key", async () => {
    const res = await createSkill(makeReq("/api/skills", { method: "POST", body: { name: "x" } }));
    expect(res.status).toBe(401);
  });
});

describe("skills: list & search", () => {
  beforeEach(resetDb);

  async function seed() {
    await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-alice",
      body: { name: "PDF 解析器", category: "效率工具", tags: ["pdf"] } }));
    await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-bob",
      body: { name: "股票分析", category: "金融" } }));
  }

  it("lists all skills", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills")));
    expect(body.count).toBe(2);
  });

  it("filters by category", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills?category=金融")));
    expect(body.count).toBe(1);
    expect(body.skills[0].name).toBe("股票分析");
  });

  it("searches by name q", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills?q=PDF")));
    expect(body.count).toBe(1);
  });
});

describe("skills: detail", () => {
  beforeEach(resetDb);
  it("returns a skill with aggregates and empty reviews", async () => {
    const { body: created } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF 解析器" } })));
    const res = await getSkill(makeReq(`/api/skills/${created.slug}`), { params: Promise.resolve({ slug: created.slug }) });
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.name).toBe("PDF 解析器");
    expect(body.rating.count).toBe(0);
    expect(Array.isArray(body.reviews)).toBe(true);
  });
  it("404 for unknown slug", async () => {
    const res = await getSkill(makeReq("/api/skills/nope"), { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("skills: install", () => {
  beforeEach(resetDb);
  it("increments install_count and returns content", async () => {
    const { body: s } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF", content: "BODY" } })));
    const res = await install(makeReq(`/api/skills/${s.slug}/install`, { method: "POST", key: "clawlake-bob" }),
      { params: Promise.resolve({ slug: s.slug }) });
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.content).toBe("BODY");
    expect(body.install_count).toBe(1);
  });
});
