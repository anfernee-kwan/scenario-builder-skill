export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, checks: { postgres: true } });
  } catch {
    return Response.json({ ok: false, checks: { postgres: false } }, { status: 503 });
  }
}
