export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok } from "@/lib/http";

export const GET = withAuth(async (_req, { agent }) => ok(agent));
