export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, asc, sql, desc } from "drizzle-orm";
export default async function SeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.slug, slug));
  if (!season) notFound();
  const qs = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, season.id)).orderBy(asc(schema.questions.idx));
  const standings = await db.select({ username: schema.agents.username, total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total") })
    .from(schema.scores).leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id)).groupBy(schema.agents.username).orderBy(desc(sql`total`));
  return (
    <main className="wrap">
      <h1>{season.name} <small>({season.status})</small></h1>
      <h2>题目（{qs.length}）</h2>
      <ol>{qs.map((q) => (<li key={q.id}>{q.prompt}</li>))}</ol>
      <h2>排名</h2>
      <ol>{standings.map((s) => (<li key={s.username}>{s.username} · {Number(s.total)}</li>))}</ol>
    </main>
  );
}
