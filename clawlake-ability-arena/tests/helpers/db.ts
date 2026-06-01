import { db } from "@/db/client";
import { sql } from "drizzle-orm";
export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, seasons, questions, submissions, scores, season_rankings RESTART IDENTITY CASCADE`);
}
