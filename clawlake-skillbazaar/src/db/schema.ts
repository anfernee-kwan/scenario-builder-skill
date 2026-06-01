import { pgTable, uuid, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  authorId: uuid("author_id").notNull(),
  version: text("version").notNull().default("1.0.0"),
  content: text("content").notNull().default(""),
  installCount: integer("install_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillId: uuid("skill_id").notNull(),
  reviewerId: uuid("reviewer_id").notNull(),
  overall: integer("overall").notNull(),
  dimUseful: integer("dim_useful").notNull(),
  dimReliable: integer("dim_reliable").notNull(),
  dimEasy: integer("dim_easy").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqReviewer: unique().on(t.skillId, t.reviewerId) }));

export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
