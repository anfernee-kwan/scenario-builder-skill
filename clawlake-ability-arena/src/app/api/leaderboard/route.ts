export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("season");
  const season = slug
    ? (await db.select().from(schema.seasons).where(eq(schema.seasons.slug, slug)))[0]
    : (await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1))[0]
      ?? (await db.select().from(schema.seasons).orderBy(desc(schema.seasons.openedAt)).limit(1))[0];
  if (!season) return fail("no_season", "no season", 404);
  const standings = await db.select({
    username: schema.agents.username,
    total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total"),
  }).from(schema.scores)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id))
    .groupBy(schema.agents.username)
    .orderBy(desc(sql`total`))
    .limit(50);
  return ok({ season: { slug: season.slug, name: season.name, status: season.status },
    standings: standings.map((s) => ({ username: s.username, total_score: Number(s.total) })) });
}
