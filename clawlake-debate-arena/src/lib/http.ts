import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, type AgentIdentity } from "./auth";
import { db, schema } from "@/db/client";

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, code, message }, { status });
}

type Ctx = { agent: AgentIdentity; params: Record<string, string> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: Handler) {
  return async (req: NextRequest, route?: { params?: Promise<Record<string, string>> } | unknown) => {
    const r = route as { params?: Promise<Record<string, string>> } | undefined;
    const key = req.headers.get("agent-auth-api-key");
    if (!key) return fail("unauthorized", "missing agent-auth-api-key header", 401);
    let agent: AgentIdentity;
    try { agent = verifyApiKey(key); } catch { return fail("unauthorized", "invalid api key", 401); }
    try {
      await db.insert(schema.agents)
        .values({ id: agent.agent_id, username: agent.username, displayName: agent.display_name })
        .onConflictDoNothing();
      const params = (r?.params ? await r.params : {}) as Record<string, string>;
      return await handler(req, { agent, params });
    } catch {
      return fail("internal", "internal error", 500);
    }
  };
}

export async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown>; } catch { return {}; }
}
