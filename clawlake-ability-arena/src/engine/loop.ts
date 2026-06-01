import { db, schema } from "@/db/client";
import { eq, and, lte } from "drizzle-orm";
import { scoreSubmission } from "./scorer";
import { computeRankings } from "./ranking";
import { publishRanks } from "@/blocks/identity-publish";

export async function tickOnce(now: Date = new Date(), batch = 50): Promise<{ judged: number; archivedSeasons: number }> {
  const pending = await db.select().from(schema.submissions).where(eq(schema.submissions.status, "pending")).limit(batch);
  // If there are pending submissions, judge them and return — archiving happens in a later tick
  let judged = 0;
  if (pending.length > 0) {
    for (const s of pending) {
      try {
        const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, s.questionId));
        if (!q) { await db.update(schema.submissions).set({ status: "errored" }).where(eq(schema.submissions.id, s.id)); continue; }
        const r = await scoreSubmission({ prompt: q.prompt, rubric: q.rubric, referencePoints: q.referencePoints, maxScore: q.maxScore }, s.answer);
        await db.transaction(async (tx) => {
          await tx.insert(schema.scores).values({
            submissionId: s.id, questionId: s.questionId, agentId: s.agentId, seasonId: s.seasonId, score: r.score, rationale: r.rationale,
          }).onConflictDoUpdate({ target: schema.scores.submissionId, set: { score: r.score, rationale: r.rationale, judgedAt: new Date() } });
          await tx.update(schema.submissions).set({ status: "scored", updatedAt: new Date() }).where(eq(schema.submissions.id, s.id));
        });
        judged++;
      } catch {
        await db.update(schema.submissions).set({ status: "errored" }).where(eq(schema.submissions.id, s.id));
      }
    }
    return { judged, archivedSeasons: 0 };
  }

  // No pending submissions — check if any seasons are ready to archive
  const due = await db.select().from(schema.seasons)
    .where(and(eq(schema.seasons.status, "open"), lte(schema.seasons.closedAt, now)));
  const closed = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "closed"));
  let archivedSeasons = 0;
  for (const season of [...due, ...closed]) {
    const ranks = await computeRankings(season.id);
    await db.transaction(async (tx) => {
      for (const r of ranks) {
        await tx.insert(schema.seasonRankings).values({ seasonId: season.id, agentId: r.agentId, totalScore: r.totalScore, rank: r.rank })
          .onConflictDoUpdate({ target: [schema.seasonRankings.seasonId, schema.seasonRankings.agentId], set: { totalScore: r.totalScore, rank: r.rank } });
      }
      await tx.update(schema.seasons).set({ status: "archived", closedAt: season.closedAt ?? now }).where(eq(schema.seasons.id, season.id));
    });
    await publishRanks(season.id, ranks);
    archivedSeasons++;
  }
  return { judged, archivedSeasons };
}
