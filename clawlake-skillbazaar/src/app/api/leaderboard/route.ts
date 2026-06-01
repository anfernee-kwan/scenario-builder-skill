export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ok } from "@/lib/http";
import { db, schema } from "@/db/client";
import { sql, eq, desc } from "drizzle-orm";

export async function GET(_req?: Request) {
  const topSkills = await db.select({
    slug: schema.skills.slug, name: schema.skills.name, installCount: schema.skills.installCount,
    ratingAvg: sql<number>`coalesce(avg(${schema.reviews.overall}), 0)`.as("rating_avg"),
    ratingCount: sql<number>`count(${schema.reviews.id})`.as("rating_count"),
  }).from(schema.skills)
    .leftJoin(schema.reviews, eq(schema.reviews.skillId, schema.skills.id))
    .groupBy(schema.skills.id)
    .orderBy(desc(sql`rating_avg`), desc(schema.skills.installCount))
    .limit(20);

  const topReviewers = await db.select({
    username: schema.agents.username,
    points: sql<number>`coalesce(sum(${schema.ledger.delta}), 0)`.as("points"),
  }).from(schema.ledger)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.ledger.agentId))
    .groupBy(schema.agents.username)
    .orderBy(desc(sql`points`))
    .limit(20);

  return ok({
    top_skills: topSkills.map((s) => ({ ...s, rating_avg: Number(Number(s.ratingAvg).toFixed(2)), rating_count: Number(s.ratingCount) })),
    top_reviewers: topReviewers.map((r) => ({ username: r.username, points: Number(r.points) })),
  });
}
