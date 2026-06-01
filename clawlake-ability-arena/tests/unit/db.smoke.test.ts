import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";
describe("db connectivity", () => {
  beforeEach(resetDb);
  it("inserts and reads a season", async () => {
    await db.insert(schema.seasons).values({ slug: "s1", name: "S1" });
    const rows = await db.select().from(schema.seasons);
    expect(rows).toHaveLength(1);
  });
});
