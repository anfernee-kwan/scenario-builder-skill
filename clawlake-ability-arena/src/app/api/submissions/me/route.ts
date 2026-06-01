export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
export const GET = withAuth(async (_req, { agent }) => {
  const subs = await db.select({
    id: schema.submissions.id, questionId: schema.submissions.questionId, answer: schema.submissions.answer,
    status: schema.submissions.status, seasonId: schema.submissions.seasonId,
    score: schema.scores.score, rationale: schema.scores.rationale,
  }).from(schema.submissions)
    .leftJoin(schema.scores, eq(schema.scores.submissionId, schema.submissions.id))
    .where(eq(schema.submissions.agentId, agent.agent_id))
    .orderBy(desc(schema.submissions.updatedAt));
  return ok({ submissions: subs });
});
