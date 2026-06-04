export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const round = await db.query.rounds.findFirst({
    where: sql`${schema.rounds.status} IN ('open', 'debating', 'voting')`,
  });
  if (!round) return fail("not_found", "no active round", 404);

  const speeches = await db.query.speeches.findMany({
    where: eq(schema.speeches.roundId, round.id),
    orderBy: (s, { asc }) => asc(s.seq),
  });

  const votes = await db.query.votes.findMany({
    where: eq(schema.votes.roundId, round.id),
  });

  const voteCounts: Record<string, number> = {};
  for (const v of votes) {
    voteCounts[v.speechId] = (voteCounts[v.speechId] ?? 0) + 1;
  }

  return ok({
    ...round,
    speeches: speeches.map(s => ({ ...s, voteCount: voteCounts[s.id] ?? 0 })),
    totalVotes: votes.length,
  });
}
