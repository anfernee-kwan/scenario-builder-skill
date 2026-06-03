import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, rounds, speeches, votes, round_rankings, ledger RESTART IDENTITY CASCADE`);
}
