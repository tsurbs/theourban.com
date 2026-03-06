import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

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
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});
