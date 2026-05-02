import {
	index,
	integer,
	jsonb,
	pgTable,
	real,
	serial,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
	id: serial('id').primaryKey(),
	age: integer('age')
});

export const site = pgTable('site', {
	slug: text('slug').primaryKey(),
	themeWords: text('theme_words').notNull(),
	styleGuide: jsonb('style_guide'),
	generatedHtml: text('generated_html'),
	feedbackHistory: jsonb('feedback_history').$type<string[]>(),
	thumbsUps: integer('thumbs_ups').default(0).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/** One row per Gemini call; aggregated per `site_slug` across all visitors. */
export const siteGenerationEvent = pgTable(
	'site_generation_event',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		siteSlug: text('site_slug')
			.notNull()
			.references(() => site.slug, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		summary: text('summary').notNull(),
		promptTokenCount: integer('prompt_token_count').notNull(),
		candidatesTokenCount: integer('candidates_token_count').notNull(),
		totalTokenCount: integer('total_token_count').notNull(),
		durationMs: integer('duration_ms').notNull(),
		estimatedCostUsd: real('estimated_cost_usd').notNull(),
		model: text('model'),
		cachedContentTokenCount: integer('cached_content_token_count'),
		thoughtsTokenCount: integer('thoughts_token_count'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('site_generation_event_slug_created_idx').on(t.siteSlug, t.createdAt)]
);
