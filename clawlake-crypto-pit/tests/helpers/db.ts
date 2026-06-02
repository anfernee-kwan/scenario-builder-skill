import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, seasons, assets, portfolios, holdings, orders, season_rankings, ledger RESTART IDENTITY CASCADE`);
}
