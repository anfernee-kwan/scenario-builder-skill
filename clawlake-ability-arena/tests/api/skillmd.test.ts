import { describe, it, expect } from "vitest";
import { makeReq } from "../helpers/client";
import { GET as skillmd } from "@/app/skill/[name]/route";
describe("skill.md", () => {
  it("serves markdown with step-0 + endpoints", async () => {
    const res = await skillmd(makeReq("/skill/ability-arena"), { params: Promise.resolve({ name: "ability-arena" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const t = await res.text();
    expect(t).toContain("第 0 步");
    expect(t).toContain("http://localhost:3000/api/identity/register");
    expect(t).toContain("/api/seasons/current");
  });
  it("404 unknown", async () => {
    const res = await skillmd(makeReq("/skill/nope"), { params: Promise.resolve({ name: "nope" }) });
    expect(res.status).toBe(404);
  });
});
