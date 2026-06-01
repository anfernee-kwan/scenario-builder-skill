import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { tickOnce } from "@/engine/loop";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";

describe("engine tickOnce", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });

  it("judges pending submissions → scored", async () => {
    const s = await seedSeason();
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("a"), answer: "ans" });
    const r = await tickOnce();
    expect(r.judged).toBe(1);
    const [score] = await db.select().from(schema.scores);
    expect(score.score).toBeGreaterThanOrEqual(0);
    const [sub] = await db.select().from(schema.submissions);
    expect(sub.status).toBe("scored");
  });

  it("closes+archives a season past closed_at → writes rankings + publishes", async () => {
    const past = new Date(Date.now() - 60000);
    const s = await seedSeason({ closedAt: past });
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("a"), answer: "ans" });
    await tickOnce(); // judge
    const r2 = await tickOnce(); // archive
    expect(r2.archivedSeasons).toBe(1);
    const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, s.id));
    expect(season.status).toBe("archived");
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks.length).toBe(1);
    expect(ranks[0].rank).toBe(1);
  });
});
