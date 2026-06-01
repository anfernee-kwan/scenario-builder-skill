import { createHash } from "node:crypto";
export interface JudgeResult { score: number; rationale: string; }

function mockJudge(prompt: string, answer: string, max: number): JudgeResult {
  const h = createHash("sha256").update(prompt + "\n" + answer).digest();
  const score = h[0] % (max + 1);
  return { score, rationale: `mock judge: deterministic ${score}/${max}` };
}

export async function judge(opts: { prompt: string; rubric: string; referencePoints: string; answer: string; max: number; }): Promise<JudgeResult> {
  if (process.env.LLM_MOCK === "1" || !process.env.LLM_API_KEY) return mockJudge(opts.prompt, opts.answer, opts.max);
  const base = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  const sys = `You are a strict judge. Score the answer 0-${opts.max} per the rubric. Respond ONLY as JSON {"score": <int>, "rationale": "<short>"}.`;
  const user = `Question: ${opts.prompt}\nReference: ${opts.referencePoints}\nRubric: ${opts.rubric}\nAnswer: ${opts.answer}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const data = await res.json();
  const txt: string = data?.choices?.[0]?.message?.content ?? "{}";
  const m = txt.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { score: 0, rationale: "unparseable" };
  const score = Math.max(0, Math.min(opts.max, Math.round(Number(parsed.score) || 0)));
  return { score, rationale: String(parsed.rationale ?? "") };
}
