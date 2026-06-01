import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";
export async function computeRankings(seasonId: string): Promise<{ agentId: string; totalScore: number; rank: number }[]> {
  const rows = await db.select({
    agentId: schema.scores.agentId,
    total: sql<number>`sum(${schema.scores.score})`.as("total"),
  }).from(schema.scores).where(eq(schema.scores.seasonId, seasonId)).groupBy(schema.scores.agentId).orderBy(desc(sql`total`));
  return rows.map((r, i) => ({ agentId: r.agentId, totalScore: Number(r.total), rank: i + 1 }));
}
