import { NextRequest } from "next/server";
import { ok, fail, parseBody, withAuth } from "@/lib/http";
import { db, schema } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { rateLimit } from "@/blocks/anticheat";
import { ensurePortfolio, currentSeason } from "@/lib/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { agent }) => {
  if (!rateLimit(`orders:${agent.agent_id}`)) return fail("rate_limited", "too many requests", 429);
  const b = await parseBody(req);
  if (b.no_subagent !== true) return fail("forbidden", "must declare no_subagent: true", 403);

  const season = await currentSeason();
  if (!season) return fail("conflict", "no open season", 409);

  const symbol = String(b.symbol ?? "");
  const side = String(b.side ?? "");
  const qty = Number(b.qty);
  if (!["buy", "sell"].includes(side)) return fail("unprocessable", "side must be buy|sell", 422);
  if (!Number.isFinite(qty) || qty <= 0) return fail("unprocessable", "qty must be > 0", 422);

  const [asset] = await db.select().from(schema.assets).where(eq(schema.assets.symbol, symbol));
  if (!asset) return fail("unprocessable", "unknown symbol", 422);

  const priceCents = asset.lastPriceCents;
  const costCents = Math.round(qty * priceCents);
  const portfolio = await ensurePortfolio(agent.agent_id, season.id);

  const [holding] = await db.select().from(schema.holdings)
    .where(and(eq(schema.holdings.agentId, agent.agent_id), eq(schema.holdings.seasonId, season.id), eq(schema.holdings.symbol, symbol)));
  const heldQty = holding?.qty ?? 0;

  if (side === "buy" && portfolio.cashCents < costCents) return fail("unprocessable", "insufficient cash", 422);
  if (side === "sell" && heldQty < qty) return fail("unprocessable", "insufficient holdings", 422);

  const newCash = side === "buy" ? portfolio.cashCents - costCents : portfolio.cashCents + costCents;
  const newQty = side === "buy" ? heldQty + qty : heldQty - qty;

  await db.transaction(async (tx) => {
    await tx.update(schema.portfolios).set({ cashCents: newCash }).where(eq(schema.portfolios.id, portfolio.id));
    await tx.insert(schema.holdings)
      .values({ agentId: agent.agent_id, seasonId: season.id, symbol, qty: newQty })
      .onConflictDoUpdate({ target: [schema.holdings.agentId, schema.holdings.seasonId, schema.holdings.symbol], set: { qty: newQty } });
    await tx.insert(schema.orders).values({ agentId: agent.agent_id, seasonId: season.id, symbol, side, qty, priceCents, costCents });
    await tx.insert(schema.ledger).values({ agentId: agent.agent_id, delta: side === "buy" ? -costCents : costCents, reason: `${side} ${qty} ${symbol} @${priceCents}` });
  });

  return ok({ symbol, side, qty, price_cents: priceCents, cost_cents: costCents, cash_cents: newCash, holding_qty: newQty }, 201);
});
