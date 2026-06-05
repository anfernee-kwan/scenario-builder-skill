export const userAgentBindings = pgTable("user_agent_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  email: text("email"),
  channel: text("channel").notNull().default("email"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});
