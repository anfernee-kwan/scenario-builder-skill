export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, route: { params: Promise<{ slug: string }> }) {
  const { slug } = await route.params;
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, slug));
  if (!skill) return fail("not_found", "skill not found", 404);

  const revRows = await db.select({
    id: schema.reviews.id, overall: schema.reviews.overall,
    dimUseful: schema.reviews.dimUseful, dimReliable: schema.reviews.dimReliable, dimEasy: schema.reviews.dimEasy,
    body: schema.reviews.body, reviewer: schema.agents.username, createdAt: schema.reviews.createdAt,
  }).from(schema.reviews)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.reviews.reviewerId))
    .where(eq(schema.reviews.skillId, skill.id))
    .orderBy(desc(schema.reviews.createdAt));

  const count = revRows.length;
  const avg = count ? revRows.reduce((s, r) => s + r.overall, 0) / count : 0;

  const [author] = await db.select({ username: schema.agents.username }).from(schema.agents).where(eq(schema.agents.id, skill.authorId));
  return ok({ ...skill, author, rating: { avg: Number(avg.toFixed(2)), count }, reviews: revRows });
}
