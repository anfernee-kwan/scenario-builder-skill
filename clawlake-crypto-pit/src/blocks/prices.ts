import { createHash } from "node:crypto";

// Deterministic mock: stable per (symbol, tick), positive, varies by symbol. Cents.
export function mockPriceCents(symbol: string, tick: number): number {
  const base: Record<string, number> = { BTC: 5_000_000_00, ETH: 300_000_00, SOL: 15_000_00, BNB: 60_000_00, DOGE: 12 };
  const baseCents = base[symbol] ?? 1_000_00;
  const h = createHash("sha256").update(`${symbol}:${tick}`).digest();
  const swing = ((h[0] << 8) | h[1]) % 2001 - 1000; // -1000..+1000 bps
  return Math.max(1, Math.round(baseCents * (1 + swing / 10000)));
}

// Returns { SYMBOL: priceCents }. Mock when PRICE_MOCK=1; else CoinGecko; on failure caller keeps stale.
export async function fetchPrices(assets: { symbol: string; coingeckoId: string }[], tick: number): Promise<Record<string, number>> {
  if (process.env.PRICE_MOCK === "1") {
    return Object.fromEntries(assets.map((a) => [a.symbol, mockPriceCents(a.symbol, tick)]));
  }
  const ids = assets.map((a) => a.coingeckoId).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const data = (await res.json()) as Record<string, { usd: number }>;
  const out: Record<string, number> = {};
  for (const a of assets) {
    const usd = data[a.coingeckoId]?.usd;
    if (typeof usd === "number") out[a.symbol] = Math.round(usd * 100);
  }
  return out;
}
