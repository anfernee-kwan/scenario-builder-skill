import { describe, it, expect } from "vitest";
import { verifyApiKey } from "@/lib/auth";
import { uuidFromString } from "@/lib/ids";

describe("verifyApiKey (stub)", () => {
  it("parses username from clawlake-<name> and derives agent_id", () => {
    const id = verifyApiKey("clawlake-alice");
    expect(id.username).toBe("alice");
    expect(id.agent_id).toBe(uuidFromString("clawlake-alice"));
    expect(id.display_name).toBe("alice");
  });
  it("throws on empty key", () => {
    expect(() => verifyApiKey("")).toThrow();
  });
});
