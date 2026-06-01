export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "ability-arena",
    skill_md: `${base}/skill/ability-arena`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "cron",
    endpoints: ["GET /api/seasons/current", "POST /api/seasons/{id}/submit", "GET /api/submissions/me", "GET /api/leaderboard"],
  });
}
