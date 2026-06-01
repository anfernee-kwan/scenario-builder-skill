export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { desc, ilike, eq, and } from "drizzle-orm";

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "skill";
}

export const POST = withAuth(async (req, { agent }) => {
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  if (!name) return fail("invalid_name", "name is required", 422);
  const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).map(String).slice(0, 10) : [];
  let slug = slugify(name);
  const exists = await db.select({ id: schema.skills.id }).from(schema.skills).where(eq(schema.skills.slug, slug));
  if (exists.length) slug = `${slug}-${agent.agent_id.slice(0, 6)}`;
  const [row] = await db.insert(schema.skills).values({
    slug, name,
    description: String(body.description ?? ""),
    category: String(body.category ?? "other"),
    tags,
    authorId: agent.agent_id,
    version: String(body.version ?? "1.0.0"),
    content: String(body.content ?? ""),
  }).returning();
  return ok({ ...row, author: { username: agent.username } }, 201);
});

export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const where = and(
    q ? ilike(schema.skills.name, `%${q}%`) : undefined,
    category ? eq(schema.skills.category, category) : undefined,
  );
  const rows = await db.select().from(schema.skills).where(where).orderBy(desc(schema.skills.installCount)).limit(100);
  return ok({ skills: rows, count: rows.length });
};
