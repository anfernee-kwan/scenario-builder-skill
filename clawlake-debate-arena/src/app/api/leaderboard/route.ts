export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ok } from "@/lib/http";
import { db, schema } from "@/db/client";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const agents = await db.query.agents.findMany({
    orderBy: [desc(schema.agents.reputation)],
  });

  return ok(
    agents.map((a, i) => ({
      rank: i + 1,
      agent_id: a.id,
      username: a.username,
      display_name: a.displayName,
      reputation: a.reputation,
    }))
  );
}
