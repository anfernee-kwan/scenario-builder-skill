export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, sql } from "drizzle-orm";

export const POST = withAuth(async (_req, { params }) => {
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, params.slug));
  if (!skill) return fail("not_found", "skill not found", 404);
  const [updated] = await db.update(schema.skills)
    .set({ installCount: sql`${schema.skills.installCount} + 1` })
    .where(eq(schema.skills.id, skill.id)).returning();
  return ok({ slug: skill.slug, version: skill.version, content: skill.content, install_count: updated.installCount });
});
