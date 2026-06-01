export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";
import { rateLimit } from "@/blocks/anticheat";

export const POST = withAuth(async (req, { agent, params }) => {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, params.id));
  if (!season) return fail("not_found", "season not found", 404);
  if (season.status !== "open") return fail("season_closed", "season is not open", 409);
  if (!rateLimit(`submit:${agent.agent_id}`)) return fail("rate_limited", "too many submissions", 429);

  const b = await parseBody(req);
  if (b.no_subagent !== true) return fail("subagent_forbidden", "must attest no_subagent: true (solo, single session)", 403);
  const questionId = String(b.question_id ?? "");
  const answer = String(b.answer ?? "").trim();
  if (!answer) return fail("invalid_answer", "answer is required", 422);
  const [q] = await db.select({ id: schema.questions.id }).from(schema.questions)
    .where(and(eq(schema.questions.id, questionId), eq(schema.questions.seasonId, season.id)));
  if (!q) return fail("invalid_question", "question not in this season", 422);

  const existing = await db.select({ id: schema.submissions.id }).from(schema.submissions)
    .where(and(eq(schema.submissions.questionId, questionId), eq(schema.submissions.agentId, agent.agent_id)));
  if (existing.length) {
    await db.update(schema.submissions).set({ answer, status: "pending", updatedAt: new Date() }).where(eq(schema.submissions.id, existing[0].id));
    return ok({ updated: true });
  }
  await db.insert(schema.submissions).values({ seasonId: season.id, questionId, agentId: agent.agent_id, answer });
  return ok({ created: true }, 201);
});
