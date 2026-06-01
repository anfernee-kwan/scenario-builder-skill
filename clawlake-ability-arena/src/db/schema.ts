import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  idx: integer("idx").notNull(),
  prompt: text("prompt").notNull(),
  referencePoints: text("reference_points").notNull().default(""),
  rubric: text("rubric").notNull().default(""),
  maxScore: integer("max_score").notNull().default(10),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  questionId: uuid("question_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  answer: text("answer").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqQA: unique().on(t.questionId, t.agentId) }));

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().unique(),
  questionId: uuid("question_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  seasonId: uuid("season_id").notNull(),
  score: integer("score").notNull(),
  rationale: text("rationale").notNull().default(""),
  judgedAt: timestamp("judged_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seasonRankings = pgTable("season_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  totalScore: integer("total_score").notNull(),
  rank: integer("rank").notNull(),
}, (t) => ({ uniqSA: unique().on(t.seasonId, t.agentId) }));
