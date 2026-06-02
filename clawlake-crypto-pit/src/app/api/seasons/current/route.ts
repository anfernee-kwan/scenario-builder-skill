import { ok, fail } from "@/lib/http";
import { STARTING_CASH_CENTS, currentSeason } from "@/lib/portfolio";
import { db, schema } from "@/db/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const season = await currentSeason();
  if (!season) return fail("conflict", "no open season", 409);
  const assets = await db.select().from(schema.assets);
  return ok({ season: { id: season.id, slug: season.slug, name: season.name }, starting_cash_cents: STARTING_CASH_CENTS, symbols: assets.map((a) => a.symbol) });
}
