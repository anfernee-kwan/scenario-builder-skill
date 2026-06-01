import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, skills, reviews, ledger RESTART IDENTITY CASCADE`);
}
