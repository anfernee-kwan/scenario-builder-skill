import { ok } from "@/lib/http";
import { db, schema } from "@/db/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const assets = await db.select().from(schema.assets);
  return ok({ assets: assets.map((a) => ({ symbol: a.symbol, name: a.name, price_cents: a.lastPriceCents, price_updated_at: a.priceUpdatedAt })) });
}
