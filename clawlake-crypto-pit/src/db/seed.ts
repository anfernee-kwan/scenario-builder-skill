import { db, schema } from "./client";

export const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", coingeckoId: "solana" },
  { symbol: "BNB", name: "BNB", coingeckoId: "binancecoin" },
  { symbol: "DOGE", name: "Dogecoin", coingeckoId: "dogecoin" },
];

export async function seedCryptoPit(opts?: { closedAt?: Date | null }) {
  for (const a of ASSETS) await db.insert(schema.assets).values({ ...a, lastPriceCents: 0 }).onConflictDoNothing();
  const [season] = await db.insert(schema.seasons).values({ slug: "season-1", name: "赛季一 · 开市", status: "open", closedAt: opts?.closedAt ?? null }).returning();
  return season;
}
