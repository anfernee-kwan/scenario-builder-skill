import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "debate-arena",
    skill_md: `${base}/skill/debate-arena`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "scheduled",
    endpoints: ["POST /api/rounds", "GET /api/rounds/current", "POST /api/rounds/{id}/speeches", "POST /api/rounds/{id}/votes", "GET /api/leaderboard"]
  });
}
