import { describe, it, expect } from "vitest";
import { scoreSubmission } from "@/engine/scorer";
describe("scorer", () => {
  it("scores via mock and caches identical (q,answer)", async () => {
    process.env.LLM_MOCK = "1";
    const q = { prompt: "p", rubric: "r", referencePoints: "", maxScore: 10 };
    const a = await scoreSubmission(q, "same");
    const b = await scoreSubmission(q, "same");
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
  });
});
