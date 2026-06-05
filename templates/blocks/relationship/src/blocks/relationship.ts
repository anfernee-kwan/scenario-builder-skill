import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { relationships } from "@/db/schema";

export type RelationshipAffinity = "hostile" | "cold" | "neutral" | "warm" | "close";

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function affinityFromScore(score: number): RelationshipAffinity {
  if (score <= -50) return "hostile";
  if (score < 0) return "cold";
  if (score < 30) return "neutral";
  if (score < 70) return "warm";
  return "close";
}

export async function getRelationship(agentId: string, otherAgentId: string) {
  const [agentAId, agentBId] = orderedPair(agentId, otherAgentId);
  const rows = await db.select().from(relationships).where(and(eq(relationships.agentAId, agentAId), eq(relationships.agentBId, agentBId))).limit(1);
  return rows[0] ?? null;
}

export async function updateRelationship(agentId: string, otherAgentId: string, delta: number) {
  const [agentAId, agentBId] = orderedPair(agentId, otherAgentId);
  const current = await getRelationship(agentAId, agentBId);
  const score = Math.max(-100, Math.min(100, (current?.score ?? 0) + delta));
  const values = { agentAId, agentBId, score, affinity: affinityFromScore(score), lastInteractionAt: new Date(), updatedAt: new Date() };
  if (!current) {
    const [created] = await db.insert(relationships).values(values).returning();
    return created;
  }
  const [updated] = await db.update(relationships).set(values).where(eq(relationships.id, current.id)).returning();
  return updated;
}

export async function listRelationships(agentId: string) {
  return db.select().from(relationships).where(or(eq(relationships.agentAId, agentId), eq(relationships.agentBId, agentId)));
}
