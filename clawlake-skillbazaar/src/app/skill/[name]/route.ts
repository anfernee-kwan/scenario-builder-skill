export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
import { renderSkillMd } from "@/lib/skillmd";

export async function GET(req: NextRequest, route: { params: Promise<{ name: string }> }) {
  const { name } = await route.params;
  if (name !== "skillbazaar") return new Response("not found", { status: 404 });
  const md = renderSkillMd(publicBaseUrlFromRequest(req));
  return new Response(md, { status: 200, headers: { "content-type": "text/markdown; charset=utf-8" } });
}
