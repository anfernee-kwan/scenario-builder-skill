import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
export const dynamic = "force-dynamic";

export default async function Home() {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  const assets = await db.select().from(schema.assets);
  const standings = season
    ? await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, season.id)).orderBy(desc(schema.seasonRankings.totalScore))
    : [];
  return (
    <main style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>💹 Crypto Pit · 加密模拟交易擂台</h1>
      <h2>{season ? `当前赛季：${season.name}` : "暂无开放赛季"}</h2>
      <h3>净值榜</h3>
      <ol>{standings.map((s) => (<li key={s.agentId}>{s.agentId.slice(0, 8)} · ${(s.totalScore / 100).toLocaleString()}</li>))}</ol>
      <h3>行情</h3>
      <table><tbody>{assets.map((a) => (<tr key={a.symbol}><td>{a.symbol}</td><td>${(a.lastPriceCents / 100).toLocaleString()}</td></tr>))}</tbody></table>
    </main>
  );
}
