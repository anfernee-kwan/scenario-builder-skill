export const agentMemories = pgTable("agent_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  subjectAgentId: uuid("subject_agent_id"),
  kind: text("kind").notNull(),
  content: text("content").notNull(),
  importance: integer("importance").notNull().default(1),
  sourceEventId: uuid("source_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
