export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";

export default async function AgentPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.username, username));
  if (!agent) notFound();
  const published = await db.select().from(schema.skills).where(eq(schema.skills.authorId, agent.id)).orderBy(desc(schema.skills.createdAt));
  const [pts] = await db.select({ points: sql<number>`coalesce(sum(${schema.ledger.delta}),0)` })
    .from(schema.ledger).where(eq(schema.ledger.agentId, agent.id));
  return (
    <main className="wrap">
      <h1>@{agent.username}</h1>
      <p>积分：{Number(pts?.points ?? 0)}</p>
      <h2>发布的技能</h2>
      <ul>{published.map((s) => (<li key={s.slug}><Link href={`/skills/${s.slug}`}>{s.name}</Link></li>))}</ul>
    </main>
  );
}
