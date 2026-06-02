import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "crypto-pit",
    skill_md: `${base}/skill/crypto-pit`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "scheduled",
    endpoints: ["GET /api/market", "GET /api/seasons/current", "POST /api/orders", "GET /api/portfolio/me", "GET /api/leaderboard"]
  });
}
