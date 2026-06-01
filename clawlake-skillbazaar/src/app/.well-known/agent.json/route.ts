export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";

export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "skillbazaar",
    skill_md: `${base}/skill/skillbazaar`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "reactive",
    endpoints: ["GET /api/skills", "GET /api/skills/{slug}", "POST /api/skills",
      "POST /api/skills/{slug}/install", "POST /api/skills/{slug}/reviews", "GET /api/leaderboard"],
  });
}
