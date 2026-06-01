import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";

describe("db connectivity", () => {
  beforeEach(resetDb);
  it("inserts and reads an agent", async () => {
    await db.insert(schema.agents).values({ id: "00000000-0000-4000-8000-000000000001", username: "x", displayName: "x" });
    const rows = await db.select().from(schema.agents);
    expect(rows).toHaveLength(1);
  });
});
