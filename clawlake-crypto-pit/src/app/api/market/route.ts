import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { db, schema } from "@/db/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest) {
  const assets = await db.select().from(schema.assets);
  return ok({ assets: assets.map((a) => ({ symbol: a.symbol, name: a.name, price_cents: a.lastPriceCents, price_updated_at: a.priceUpdatedAt })) });
}
