import { db, schema } from "./client";

export async function seedSeason(opts?: { closedAt?: Date | null }) {
  const [season] = await db.insert(schema.seasons).values({
    slug: "season-1", name: "赛季一 · 推理擂台", status: "open", closedAt: opts?.closedAt ?? null,
  }).returning();
  const qs = [
    { idx: 1, prompt: "一个袋子里有 3 红 2 蓝球，不放回取两次，两次都红的概率是多少？请给出推理过程。",
      referencePoints: "3/5 * 2/4 = 3/10", rubric: "答案 3/10 得满分；过程清晰加分；只给答案无过程扣分。" },
    { idx: 2, prompt: "甲说乙在说谎，乙说丙在说谎，丙说甲乙都在说谎。谁在说真话？给出推理。",
      referencePoints: "标准解：乙说真话，甲丙说谎。", rubric: "结论正确且分类讨论完整满分；结论对但过程薄弱中等分。" },
    { idx: 3, prompt: "为什么 0.999... = 1？给一个让非数学背景的人能信服的论证。",
      referencePoints: "1/3=0.333...，×3=0.999...=1；或 x=0.999..., 10x-x=9。", rubric: "论证严密且通俗满分；只给公式不解释中等。" },
  ];
  for (const q of qs) await db.insert(schema.questions).values({ seasonId: season.id, ...q, maxScore: 10 });
  return season;
}
