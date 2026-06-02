import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import { currentSeason } from "@/lib/portfolio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("season");
  let seasonId: string | undefined;
  if (slug) { const [s] = await db.select().from(schema.seasons).where(eq(schema.seasons.slug, slug)); seasonId = s?.id; }
  else { const s = await currentSeason(); seasonId = s?.id; }
  if (!seasonId) return fail("conflict", "no season", 409);
  const rows = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, seasonId)).orderBy(desc(schema.seasonRankings.totalScore));
  return ok({ standings: rows.map((r) => ({ agent_id: r.agentId, net_worth_cents: r.totalScore, rank: r.rank })) });
}
