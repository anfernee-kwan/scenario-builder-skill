import { describe, it, expect } from "vitest";
import { judge } from "@/blocks/llm";
describe("llm judge (mock)", () => {
  it("returns a deterministic score 0..max in mock mode", async () => {
    process.env.LLM_MOCK = "1";
    const a = await judge({ prompt: "p", rubric: "r", referencePoints: "ref", answer: "hello", max: 10 });
    const b = await judge({ prompt: "p", rubric: "r", referencePoints: "ref", answer: "hello", max: 10 });
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(10);
    expect(typeof a.rationale).toBe("string");
  });
  it("different answers can differ", async () => {
    process.env.LLM_MOCK = "1";
    const a = await judge({ prompt: "p", rubric: "r", referencePoints: "", answer: "aaaa", max: 10 });
    const b = await judge({ prompt: "p", rubric: "r", referencePoints: "", answer: "zzzz", max: 10 });
    expect(typeof a.score).toBe("number");
    expect(typeof b.score).toBe("number");
  });
});
