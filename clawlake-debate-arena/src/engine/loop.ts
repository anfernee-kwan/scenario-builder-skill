import { db, schema } from "@/db/client";
import { eq, sql, count, desc } from "drizzle-orm";
import { publishRanks } from "@/blocks/identity-publish";

const DEBATE_BONUS = 10;

export async function tickOnce(now: Date = new Date(), batch = 1): Promise<{ judged: number; archivedSeasons: number }> {
  let judged = 0;

  // 1) debating → voting: rounds where speech count has reached the limit
  const debatingRounds = await db.query.rounds.findMany({
    where: eq(schema.rounds.status, "debating"),
  });

  for (const round of debatingRounds.slice(0, batch)) {
    const [{ value: speechCount }] = await db
      .select({ value: count() })
      .from(schema.speeches)
      .where(eq(schema.speeches.roundId, round.id));

    if (speechCount >= round.speechLimit) {
      await db.update(schema.rounds)
        .set({ status: "voting" })
        .where(eq(schema.rounds.id, round.id));
    }
  }

  // 2) voting → closed: rounds where all registered agents have voted
  const votingRounds = await db.query.rounds.findMany({
    where: eq(schema.rounds.status, "voting"),
  });

  for (const round of votingRounds.slice(0, batch)) {
    const [{ value: agentCount }] = await db.select({ value: count() }).from(schema.agents);
    const [{ value: voteCount }] = await db
      .select({ value: count() })
      .from(schema.votes)
      .where(eq(schema.votes.roundId, round.id));

    if (agentCount === 0 || voteCount < agentCount) continue;

    // Tally votes per speech
    const speechVotes = await db
      .select({ speechId: schema.votes.speechId, tally: count() })
      .from(schema.votes)
      .where(eq(schema.votes.roundId, round.id))
      .groupBy(schema.votes.speechId)
      .orderBy(desc(count()));

    if (speechVotes.length === 0) {
      await db.update(schema.rounds)
        .set({ status: "closed", closedAt: now })
        .where(eq(schema.rounds.id, round.id));
      continue;
    }

    const maxVotes = speechVotes[0].tally;
    const winners = speechVotes.filter(sv => sv.tally === maxVotes);

    // Award bonus to all tied winners
    for (const winner of winners) {
      const speech = await db.query.speeches.findFirst({
        where: eq(schema.speeches.id, winner.speechId),
      });
      if (!speech) continue;

      // Update reputation
      await db.update(schema.agents)
        .set({ reputation: sql`${schema.agents.reputation} + ${DEBATE_BONUS}` })
        .where(eq(schema.agents.id, speech.agentId));

      // Record in ledger
      await db.insert(schema.ledger).values({
        agentId: speech.agentId,
        delta: DEBATE_BONUS,
        reason: `round:${round.id}:winner`,
      });
    }

    // Persist round_rankings
    const allAgents = await db.query.agents.findMany({ orderBy: [desc(schema.agents.reputation)] });
    for (let i = 0; i < allAgents.length; i++) {
      await db.insert(schema.roundRankings).values({
        roundId: round.id,
        agentId: allAgents[i].id,
        score: allAgents[i].reputation,
        rank: i + 1,
      }).onConflictDoNothing();
    }

    // Close round
    await db.update(schema.rounds)
      .set({ status: "closed", closedAt: now })
      .where(eq(schema.rounds.id, round.id));

    // Publish to identity service
    await publishRanks(round.id, allAgents.map((a, i) => ({
      agentId: a.id,
      rank: i + 1,
      totalScore: a.reputation,
    })));

    judged++;
  }

  // 3) Ensure there is always one open round ready for the next proposer
  const activeRound = await db.query.rounds.findFirst({
    where: sql`${schema.rounds.status} IN ('open', 'debating', 'voting')`,
  });
  if (!activeRound) {
    await db.insert(schema.rounds).values({
      slug: `round-open-${now.getTime()}`,
      topic: "",
      proposedBy: null,
      speechLimit: 5,
      status: "open",
    });
  }

  return { judged, archivedSeasons: judged };
}
