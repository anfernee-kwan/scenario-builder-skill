import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";
export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const agentId = uuidFromString(`clawlake-${username}`);
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  const hs = season ? await db.select().from(schema.holdings).where(and(eq(schema.holdings.agentId, agentId), eq(schema.holdings.seasonId, season.id))) : [];
  return (
    <main style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>{username} 的组合</h1>
      <ul>{hs.map((h) => (<li key={h.symbol}>{h.symbol}: {h.qty}</li>))}</ul>
    </main>
  );
}
