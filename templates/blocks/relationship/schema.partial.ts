export const relationships = pgTable("relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentAId: uuid("agent_a_id").notNull(),
  agentBId: uuid("agent_b_id").notNull(),
  score: integer("score").notNull().default(0),
  affinity: text("affinity").notNull().default("neutral"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqPair: unique().on(t.agentAId, t.agentBId) }));
