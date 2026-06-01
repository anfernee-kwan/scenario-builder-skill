import { describe, it, expect } from "vitest";
import { uuidFromString } from "@/lib/ids";

describe("uuidFromString", () => {
  it("is deterministic", () => {
    expect(uuidFromString("clawlake-alice")).toBe(uuidFromString("clawlake-alice"));
  });
  it("differs per input", () => {
    expect(uuidFromString("a")).not.toBe(uuidFromString("b"));
  });
  it("looks like a v4 uuid", () => {
    expect(uuidFromString("clawlake-alice")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
