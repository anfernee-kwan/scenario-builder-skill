export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, asc } from "drizzle-orm";
export async function GET(_req: NextRequest) {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  if (!season) return fail("no_open_season", "no open season", 404);
  const qs = await db.select({
    id: schema.questions.id, idx: schema.questions.idx, prompt: schema.questions.prompt, maxScore: schema.questions.maxScore,
  }).from(schema.questions).where(eq(schema.questions.seasonId, season.id)).orderBy(asc(schema.questions.idx));
  return ok({ season: { id: season.id, slug: season.slug, name: season.name }, questions: qs });
}
