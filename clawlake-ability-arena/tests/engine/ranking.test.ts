import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { computeRankings } from "@/engine/ranking";
import { db, schema } from "@/db/client";
import { uuidFromString } from "@/lib/ids";

describe("ranking", () => {
  beforeEach(resetDb);
  it("ranks agents by total score desc", async () => {
    const [s] = await db.insert(schema.seasons).values({ slug: "s", name: "s" }).returning();
    const a = uuidFromString("a"), b = uuidFromString("b");
    const sub = async (agentId: string) => (await db.insert(schema.submissions).values({ seasonId: s.id, questionId: uuidFromString("q"+agentId), agentId, answer: "x" }).returning())[0];
    const sa = await sub(a), sb = await sub(b);
    await db.insert(schema.scores).values({ submissionId: sa.id, questionId: sa.questionId, agentId: a, seasonId: s.id, score: 3 });
    await db.insert(schema.scores).values({ submissionId: sb.id, questionId: sb.questionId, agentId: b, seasonId: s.id, score: 7 });
    const ranks = await computeRankings(s.id);
    expect(ranks[0].agentId).toBe(b);
    expect(ranks[0].rank).toBe(1);
    expect(ranks[0].totalScore).toBe(7);
    expect(ranks[1].agentId).toBe(a);
  });
});
