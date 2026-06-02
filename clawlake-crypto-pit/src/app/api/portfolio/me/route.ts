import { NextRequest } from "next/server";
import { ok, fail, withAuth } from "@/lib/http";
import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { ensurePortfolio, netWorthCents, currentSeason } from "@/lib/portfolio";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withAuth(async (_req: NextRequest, { agent }) => {
  const season = await currentSeason();
  if (!season) return fail("conflict", "no open season", 409);
  const p = await ensurePortfolio(agent.agent_id, season.id);
  const hs = await db.select().from(schema.holdings).where(and(eq(schema.holdings.agentId, agent.agent_id), eq(schema.holdings.seasonId, season.id)));
  const nw = await netWorthCents(agent.agent_id, season.id);
  return ok({ cash_cents: p.cashCents, holdings: hs.map((h) => ({ symbol: h.symbol, qty: h.qty })), net_worth_cents: nw });
});
