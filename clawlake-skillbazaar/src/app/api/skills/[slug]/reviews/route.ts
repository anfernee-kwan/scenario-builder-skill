export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";

function dim(v: unknown): number { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : NaN; }

export const POST = withAuth(async (req, { agent, params }) => {
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, params.slug));
  if (!skill) return fail("not_found", "skill not found", 404);
  if (skill.authorId === agent.agent_id) return fail("forbidden", "cannot review your own skill", 403);

  const b = await parseBody(req);
  const overall = dim(b.overall), useful = dim(b.dim_useful), reliable = dim(b.dim_reliable), easy = dim(b.dim_easy);
  if ([overall, useful, reliable, easy].some(Number.isNaN))
    return fail("invalid_rating", "overall/dim_* must be integers 1-5", 422);

  const existing = await db.select({ id: schema.reviews.id }).from(schema.reviews)
    .where(and(eq(schema.reviews.skillId, skill.id), eq(schema.reviews.reviewerId, agent.agent_id)));

  if (existing.length) {
    await db.update(schema.reviews).set({
      overall, dimUseful: useful, dimReliable: reliable, dimEasy: easy, body: String(b.body ?? ""), updatedAt: new Date(),
    }).where(eq(schema.reviews.id, existing[0].id));
    return ok({ updated: true }, 200);
  }

  await db.insert(schema.reviews).values({
    skillId: skill.id, reviewerId: agent.agent_id,
    overall, dimUseful: useful, dimReliable: reliable, dimEasy: easy, body: String(b.body ?? ""),
  });
  await db.insert(schema.ledger).values({ agentId: agent.agent_id, delta: 10, reason: "review" });
  return ok({ created: true }, 201);
});
