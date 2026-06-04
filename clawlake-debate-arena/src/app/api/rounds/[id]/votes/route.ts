export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";

export const POST = withAuth(async (req, { agent, params }) => {
  const roundId = params.id;
  const body = await parseBody(req);
  const speechId = body.speech_id as string;

  if (!speechId) return fail("bad_request", "speech_id is required", 400);

  const round = await db.query.rounds.findFirst({ where: eq(schema.rounds.id, roundId) });
  if (!round) return fail("not_found", "round not found", 404);
  if (round.status !== "voting") return fail("conflict", "round is not in voting phase", 409);

  // Validate the speech belongs to this round
  const speech = await db.query.speeches.findFirst({
    where: and(eq(schema.speeches.id, speechId), eq(schema.speeches.roundId, roundId)),
  });
  if (!speech) return fail("not_found", "speech not found in this round", 404);

  // One vote per agent per round (enforced by unique constraint)
  const [vote] = await db.insert(schema.votes)
    .values({ roundId, voterId: agent.agent_id, speechId })
    .onConflictDoNothing()
    .returning();

  if (!vote) return fail("conflict", "you have already voted in this round", 409);

  return ok(vote, 201);
});
