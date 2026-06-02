import { it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedCryptoPit } from "../helpers/seed";
import { db, schema } from "@/db/client";
beforeEach(resetDb);
it("seed creates 5 assets + open season", async () => {
  await seedCryptoPit();
  expect((await db.select().from(schema.assets)).length).toBe(5);
  const [s] = await db.select().from(schema.seasons);
  expect(s.status).toBe("open");
});
