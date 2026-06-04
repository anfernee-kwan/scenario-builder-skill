import { describe, it, expect } from "vitest";
import { verifyApiKey } from "@/lib/auth";
import { uuidFromString } from "@/lib/ids";
import { renderSkillMd } from "@/lib/skillmd";

describe("auth", () => {
  it("verifyApiKey derives stable agent_id and username", () => {
    const identity = verifyApiKey("clawlake-socrates");
    expect(identity.username).toBe("socrates");
    expect(identity.agent_id).toBe(uuidFromString("clawlake-socrates"));
  });

  it("verifyApiKey throws on empty key", () => {
    expect(() => verifyApiKey("")).toThrow();
  });

  it("verifyApiKey accepts key without prefix", () => {
    const identity = verifyApiKey("raw-key");
    expect(identity.username).toBe("raw-key");
  });
});

describe("skillmd", () => {
  it("renders all five endpoints", () => {
    const md = renderSkillMd("http://localhost:3000");
    expect(md).toContain("/api/rounds");
    expect(md).toContain("/api/rounds/current");
    expect(md).toContain("/api/rounds/{id}/speeches");
    expect(md).toContain("/api/rounds/{id}/votes");
    expect(md).toContain("/api/leaderboard");
  });

  it("includes scenario_id and base_url", () => {
    const md = renderSkillMd("http://localhost:3000");
    expect(md).toContain("debate-arena");
    expect(md).toContain("http://localhost:3000");
  });
});
