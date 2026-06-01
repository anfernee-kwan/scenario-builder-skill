import { describe, it, expect } from "vitest";
import { makeReq } from "../helpers/client";
import { GET as skillmd } from "@/app/skill/[name]/route";

describe("skill.md", () => {
  it("serves markdown, no auth, with request-derived base url", async () => {
    const res = await skillmd(makeReq("/skill/skillbazaar"), { params: Promise.resolve({ name: "skillbazaar" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("第 0 步");
    expect(text).toContain("http://localhost:3000/api/identity/register");
    expect(text).toContain("/api/skills");
  });

  it("404 for unknown scenario name", async () => {
    const res = await skillmd(makeReq("/skill/nope"), { params: Promise.resolve({ name: "nope" }) });
    expect(res.status).toBe(404);
  });
});
