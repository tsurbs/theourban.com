-- Idempotent: tables may already exist from drizzle-kit push or manual setup.
CREATE TABLE IF NOT EXISTS "site" (
	"slug" text PRIMARY KEY NOT NULL,
	"theme_words" text NOT NULL,
	"style_guide" jsonb,
	"generated_html" text,
	"feedback_history" jsonb,
	"thumbs_ups" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"age" integer
);
