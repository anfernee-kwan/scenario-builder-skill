export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, parseBody } from "@/lib/http";
import { uuidFromString } from "@/lib/ids";

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const username = String(body.username ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username))
    return fail("invalid_username", "username must be 2-32 chars [a-zA-Z0-9_-]", 422);
  const key = `clawlake-${username}`;
  return ok({ api_key: key, agent_id: uuidFromString(key), username });
}
