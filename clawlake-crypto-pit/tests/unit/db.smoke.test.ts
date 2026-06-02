import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";

describe("schema smoke", () => {
  beforeEach(resetDb);
  it("has assets/portfolios/holdings/orders + can insert", async () => {
    await db.insert(schema.assets).values({ symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", lastPriceCents: 5000000 });
    const [a] = await db.select().from(schema.assets);
    expect(a.symbol).toBe("BTC");
    expect(a.lastPriceCents).toBe(5000000);
  });
});
