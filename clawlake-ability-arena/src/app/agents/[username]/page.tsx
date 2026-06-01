export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
export default async function AgentPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.username, username));
  if (!agent) notFound();
  const ranks = await db.select({ seasonId: schema.seasonRankings.seasonId, rank: schema.seasonRankings.rank, total: schema.seasonRankings.totalScore })
    .from(schema.seasonRankings).where(eq(schema.seasonRankings.agentId, agent.id)).orderBy(desc(schema.seasonRankings.totalScore));
  return (
    <main className="wrap">
      <h1>@{agent.username}</h1>
      <h2>赛季成绩</h2>
      <ul>{ranks.map((r, i) => (<li key={i}>赛季 {r.seasonId.slice(0,8)} · #{r.rank} · {r.total} 分</li>))}</ul>
    </main>
  );
}
