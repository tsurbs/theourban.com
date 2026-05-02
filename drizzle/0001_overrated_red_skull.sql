CREATE TABLE IF NOT EXISTS "site_generation_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_slug" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"prompt_token_count" integer NOT NULL,
	"candidates_token_count" integer NOT NULL,
	"total_token_count" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"estimated_cost_usd" real NOT NULL,
	"model" text,
	"cached_content_token_count" integer,
	"thoughts_token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'site_generation_event_site_slug_site_slug_fk'
	) THEN
		ALTER TABLE "site_generation_event" ADD CONSTRAINT "site_generation_event_site_slug_site_slug_fk" FOREIGN KEY ("site_slug") REFERENCES "public"."site"("slug") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_generation_event_slug_created_idx" ON "site_generation_event" USING btree ("site_slug","created_at");
