import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { agentMemories } from "@/db/schema";

export async function storeMemory(opts: { agentId: string; kind: string; content: string; subjectAgentId?: string | null; importance?: number; sourceEventId?: string | null; }) {
  const [memory] = await db.insert(agentMemories).values({
    agentId: opts.agentId,
    subjectAgentId: opts.subjectAgentId ?? null,
    kind: opts.kind,
    content: opts.content,
    importance: Math.max(1, Math.min(10, opts.importance ?? 1)),
    sourceEventId: opts.sourceEventId ?? null,
  }).returning();
  return memory;
}

export async function recallMemories(opts: { agentId: string; subjectAgentId?: string | null; limit?: number; }) {
  const subjectFilter = opts.subjectAgentId === undefined
    ? undefined
    : opts.subjectAgentId === null
      ? isNull(agentMemories.subjectAgentId)
      : eq(agentMemories.subjectAgentId, opts.subjectAgentId);
  const filters = [eq(agentMemories.agentId, opts.agentId), subjectFilter].filter(Boolean);
  return db.select().from(agentMemories)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(agentMemories.importance), desc(agentMemories.createdAt))
    .limit(opts.limit ?? 20);
}
