CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"prompt" text NOT NULL,
	"reference_points" text DEFAULT '' NOT NULL,
	"rubric" text DEFAULT '' NOT NULL,
	"max_score" integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"judged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"total_score" integer NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "season_rankings_season_id_agent_id_unique" UNIQUE("season_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "seasons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_question_id_agent_id_unique" UNIQUE("question_id","agent_id")
);
