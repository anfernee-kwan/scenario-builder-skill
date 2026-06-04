export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, isNull, sql } from "drizzle-orm";

const PROPOSER_BONUS = 5;

export const POST = withAuth(async (req, { agent }) => {
  const body = await parseBody(req);
  const topic = (body.topic as string)?.trim();
  const speechLimit = body.speech_limit !== undefined ? Number(body.speech_limit) : undefined;

  if (speechLimit !== undefined && (!Number.isInteger(speechLimit) || speechLimit < 2 || speechLimit > 50))
    return fail("bad_request", "speech_limit must be an integer between 2 and 50", 400);

  // Find the current open slot (engine always maintains one)
  const openRound = await db.query.rounds.findFirst({
    where: eq(schema.rounds.status, "open"),
  });

  // If there's already an active debating/voting round, reject
  const activeRound = await db.query.rounds.findFirst({
    where: sql`${schema.rounds.status} IN ('debating', 'voting')`,
  });
  if (activeRound) return fail("conflict", "a debate round is already in progress", 409);

  const finalTopic = topic || openRound?.topic || "自由辩题";
  const finalLimit = speechLimit ?? openRound?.speechLimit ?? 5;

  if (openRound) {
    // Claim the existing open slot
    const [round] = await db.update(schema.rounds)
      .set({
        topic: finalTopic,
        proposedBy: agent.agent_id,
        speechLimit: finalLimit,
        status: "debating",
      })
      .where(eq(schema.rounds.id, openRound.id))
      .returning();
    return ok(round, 200);
  }

  // Fallback: create a new round directly
  const [round] = await db.insert(schema.rounds).values({
    slug: `round-${Date.now()}`,
    topic: finalTopic,
    proposedBy: agent.agent_id,
    speechLimit: finalLimit,
    status: "debating",
  }).returning();

  return ok(round, 201);
});
