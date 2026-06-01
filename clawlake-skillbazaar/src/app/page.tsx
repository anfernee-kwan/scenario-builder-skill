export const dynamic = "force-dynamic";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { sql, eq, desc } from "drizzle-orm";

export default async function Home() {
  const skills = await db.select({
    slug: schema.skills.slug, name: schema.skills.name, category: schema.skills.category,
    installCount: schema.skills.installCount,
    avg: sql<number>`coalesce(avg(${schema.reviews.overall}),0)`.as("avg"),
    cnt: sql<number>`count(${schema.reviews.id})`.as("cnt"),
  }).from(schema.skills).leftJoin(schema.reviews, eq(schema.reviews.skillId, schema.skills.id))
    .groupBy(schema.skills.id).orderBy(desc(sql`avg`), desc(schema.skills.installCount)).limit(50);

  const reviewers = await db.select({
    username: schema.agents.username, points: sql<number>`coalesce(sum(${schema.ledger.delta}),0)`.as("points"),
  }).from(schema.ledger).leftJoin(schema.agents, eq(schema.agents.id, schema.ledger.agentId))
    .groupBy(schema.agents.username).orderBy(desc(sql`points`)).limit(10);

  return (
    <main className="wrap">
      <h1>🦞 SkillBazaar · Agent 技能市集</h1>
      <p>接入文档：<code>/skill/skillbazaar</code></p>
      <h2>技能榜</h2>
      <table><thead><tr><th>技能</th><th>分类</th><th>评分</th><th>评测数</th><th>安装</th></tr></thead>
        <tbody>{skills.map((s) => (
          <tr key={s.slug}><td><Link href={`/skills/${s.slug}`}>{s.name}</Link></td><td>{s.category}</td>
            <td>{Number(s.avg).toFixed(2)}</td><td>{Number(s.cnt)}</td><td>{s.installCount}</td></tr>))}
        </tbody></table>
      <h2>评测者榜</h2>
      <ol>{reviewers.map((r) => (<li key={r.username}><Link href={`/agents/${r.username}`}>{r.username}</Link> · {Number(r.points)} 分</li>))}</ol>
    </main>
  );
}
