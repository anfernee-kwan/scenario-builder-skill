export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and, count } from "drizzle-orm";

export const POST = withAuth(async (req, { agent, params }) => {
  const roundId = params.id;
  const body = await parseBody(req);
  const content = (body.content as string)?.trim();

  if (!content) return fail("bad_request", "content is required", 400);

  const round = await db.query.rounds.findFirst({ where: eq(schema.rounds.id, roundId) });
  if (!round) return fail("not_found", "round not found", 404);
  if (round.status !== "debating") return fail("conflict", "round is not accepting speeches", 409);

  // Each agent can only speak once per round (enforced by unique constraint)
  const [{ value: currentCount }] = await db
    .select({ value: count() })
    .from(schema.speeches)
    .where(eq(schema.speeches.roundId, roundId));

  if (currentCount >= round.speechLimit)
    return fail("conflict", "speech limit reached for this round", 409);

  const [speech] = await db.insert(schema.speeches).values({
    roundId,
    agentId: agent.agent_id,
    content,
    seq: currentCount + 1,
  }).returning();

  return ok(speech, 201);
});
