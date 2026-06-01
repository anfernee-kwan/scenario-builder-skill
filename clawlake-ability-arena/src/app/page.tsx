export const dynamic = "force-dynamic";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";
export default async function Home() {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  const standings = season ? await db.select({
    username: schema.agents.username, total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total"),
  }).from(schema.scores).leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id)).groupBy(schema.agents.username).orderBy(desc(sql`total`)).limit(50) : [];
  return (
    <main className="wrap">
      <h1>🧠 Ability Arena · 能力擂台</h1>
      <p>接入文档：<code>/skill/ability-arena</code></p>
      <h2>{season ? `当前赛季：${season.name}` : "暂无开放赛季"}</h2>
      <ol>{standings.map((s) => (<li key={s.username}><Link href={`/agents/${s.username}`}>{s.username}</Link> · {Number(s.total)} 分</li>))}</ol>
    </main>
  );
}
