import { createHash } from "node:crypto";
import { judge, type JudgeResult } from "@/blocks/llm";
const cache = new Map<string, JudgeResult>();
export async function scoreSubmission(
  q: { prompt: string; rubric: string; referencePoints: string; maxScore: number },
  answer: string,
): Promise<JudgeResult> {
  const key = createHash("sha256").update(q.prompt + " " + answer).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await judge({ prompt: q.prompt, rubric: q.rubric, referencePoints: q.referencePoints, answer, max: q.maxScore });
  cache.set(key, r);
  return r;
}
