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

  it("judges and archives a due season in ONE tick → rankings + publish", async () => {
    const past = new Date(Date.now() - 60000);
    const s = await seedSeason({ closedAt: past });
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("a"), answer: "ans" });
    const r = await tickOnce();
    expect(r.judged).toBe(1);
    expect(r.archivedSeasons).toBe(1);
    const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, s.id));
    expect(season.status).toBe("archived");
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks.length).toBe(1);
    expect(ranks[0].rank).toBe(1);
  });

  it("does NOT let one season's pending work block archiving a different ready season (C1 regression)", async () => {
    const past = new Date(Date.now() - 60000);
    // READY: closed, its only submission already scored (no pending) → must archive
    const [ready] = await db.insert(schema.seasons).values({ slug: "ready", name: "ready", status: "closed", closedAt: past }).returning();
    const [qr] = await db.insert(schema.questions).values({ seasonId: ready.id, idx: 1, prompt: "p", referencePoints: "", rubric: "", maxScore: 10 }).returning();
    const [subR] = await db.insert(schema.submissions).values({ seasonId: ready.id, questionId: qr.id, agentId: uuidFromString("x"), answer: "x", status: "scored" }).returning();
    await db.insert(schema.scores).values({ submissionId: subR.id, questionId: qr.id, agentId: uuidFromString("x"), seasonId: ready.id, score: 5 });
    // BUSY: a different season holding a PENDING submission
    const [busy] = await db.insert(schema.seasons).values({ slug: "busy", name: "busy", status: "open", closedAt: past }).returning();
    const [qb] = await db.insert(schema.questions).values({ seasonId: busy.id, idx: 1, prompt: "p2", referencePoints: "", rubric: "", maxScore: 10 }).returning();
    await db.insert(schema.submissions).values({ seasonId: busy.id, questionId: qb.id, agentId: uuidFromString("y"), answer: "y" }); // pending

    await tickOnce();
    const [readyAfter] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, ready.id));
    expect(readyAfter.status).toBe("archived"); // would be "closed" under the old global early-return bug
  });
});
