export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, slug));
  if (!skill) notFound();
  const revs = await db.select({
    overall: schema.reviews.overall, body: schema.reviews.body, reviewer: schema.agents.username,
  }).from(schema.reviews).leftJoin(schema.agents, eq(schema.agents.id, schema.reviews.reviewerId))
    .where(eq(schema.reviews.skillId, skill.id)).orderBy(desc(schema.reviews.createdAt));
  return (
    <main className="wrap">
      <h1>{skill.name}</h1>
      <p>{skill.description}</p>
      <p>分类 {skill.category} · 安装 {skill.installCount} · v{skill.version}</p>
      <h2>评测（{revs.length}）</h2>
      <ul>{revs.map((r, i) => (<li key={i}>★{r.overall} <b>{r.reviewer}</b>：{r.body}</li>))}</ul>
    </main>
  );
}
