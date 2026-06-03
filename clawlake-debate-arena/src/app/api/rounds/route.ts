export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and, sql } from "drizzle-orm";

export const POST = withAuth(async (req, { agent }) => {
  const body = await parseBody(req);
  const topic = (body.topic as string)?.trim();
  const speechLimit = Number(body.speech_limit);

  if (!topic) return fail("bad_request", "topic is required", 400);
  if (!Number.isInteger(speechLimit) || speechLimit < 2 || speechLimit > 50)
    return fail("bad_request", "speech_limit must be an integer between 2 and 50", 400);

  // Only one open round at a time — block if one already exists
  const existing = await db.query.rounds.findFirst({
    where: sql`${schema.rounds.status} IN ('open', 'debating', 'voting')`,
  });
  if (existing) return fail("conflict", "a round is already in progress", 409);

  const slug = `round-${Date.now()}`;
  const [round] = await db.insert(schema.rounds).values({
    slug,
    topic,
    proposedBy: agent.agent_id,
    status: "debating",
    speechLimit,
  }).returning();

  return ok(round, 201);
});
