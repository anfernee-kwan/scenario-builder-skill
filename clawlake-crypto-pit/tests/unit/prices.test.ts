import { describe, it, expect } from "vitest";
import { mockPriceCents, fetchPrices } from "@/blocks/prices";

describe("prices", () => {
  it("mock is deterministic per (symbol, tick)", () => {
    expect(mockPriceCents("BTC", 0)).toBe(mockPriceCents("BTC", 0));
    expect(mockPriceCents("BTC", 1)).not.toBe(undefined);
  });
  it("mock differs across symbols and is positive", () => {
    expect(mockPriceCents("BTC", 5)).toBeGreaterThan(0);
    expect(mockPriceCents("ETH", 5)).not.toBe(mockPriceCents("BTC", 5));
  });
  it("fetchPrices in mock mode returns a cents map for requested symbols", async () => {
    process.env.PRICE_MOCK = "1";
    const out = await fetchPrices([{ symbol: "BTC", coingeckoId: "bitcoin" }, { symbol: "ETH", coingeckoId: "ethereum" }], 3);
    expect(out.BTC).toBeGreaterThan(0);
    expect(out.ETH).toBeGreaterThan(0);
    expect(out.BTC).toBe(mockPriceCents("BTC", 3));
  });
});
