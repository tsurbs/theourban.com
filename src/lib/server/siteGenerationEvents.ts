import { desc, eq, count, sum, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { siteGenerationEvent } from '$lib/server/db/schema';
import type { GenerationCallStats } from '$lib/generationStats';

export type SiteNerdGlobalRow = {
	id: string;
	siteSlug: string;
	kind: string;
	summary: string;
	promptTokenCount: number;
	candidatesTokenCount: number;
	totalTokenCount: number;
	durationMs: number;
	estimatedCostUsd: number;
	model: string | null;
	cachedContentTokenCount: number | null;
	thoughtsTokenCount: number | null;
	createdAt: string;
};

export type SiteNerdGlobalPayload = {
	aggregates: {
		callCount: number;
		totalTokens: number;
		totalCostUsd: number;
		lastEventAt: string | null;
	};
	recentEvents: SiteNerdGlobalRow[];
};

export async function insertSiteGenerationEvent(params: {
	siteSlug: string;
	kind: 'style-guide' | 'ui';
	summary: string;
	stats: GenerationCallStats;
}): Promise<void> {
	const { siteSlug, kind, summary, stats } = params;
	if (!siteSlug) return;
	try {
		await db.insert(siteGenerationEvent).values({
			siteSlug,
			kind,
			summary,
			promptTokenCount: stats.promptTokenCount,
			candidatesTokenCount: stats.candidatesTokenCount,
			totalTokenCount: stats.totalTokenCount,
			durationMs: stats.durationMs,
			estimatedCostUsd: stats.estimatedCostUsd,
			model: stats.model ?? null,
			cachedContentTokenCount: stats.cachedContentTokenCount ?? null,
			thoughtsTokenCount: stats.thoughtsTokenCount ?? null
		});
	} catch (e) {
		console.error('insertSiteGenerationEvent failed', e);
	}
}

export async function getNerdStatsForSiteSlug(
	slug: string
): Promise<SiteNerdGlobalPayload> {
	if (!slug) {
		return {
			aggregates: {
				callCount: 0,
				totalTokens: 0,
				totalCostUsd: 0,
				lastEventAt: null
			},
			recentEvents: []
		};
	}

	const recent = await db
		.select()
		.from(siteGenerationEvent)
		.where(eq(siteGenerationEvent.siteSlug, slug))
		.orderBy(desc(siteGenerationEvent.createdAt))
		.limit(80);

	const [agg] = await db
		.select({
			callCount: count(),
			totalTokens: sum(siteGenerationEvent.totalTokenCount),
			totalCostUsd: sum(siteGenerationEvent.estimatedCostUsd),
			lastAt: max(siteGenerationEvent.createdAt)
		})
		.from(siteGenerationEvent)
		.where(eq(siteGenerationEvent.siteSlug, slug));

	const callCount = Number(agg?.callCount ?? 0);
	const totalTokens = Number(agg?.totalTokens ?? 0);
	const totalCostUsd = Number(agg?.totalCostUsd ?? 0);
	const lastEventAt = agg?.lastAt ? new Date(agg.lastAt).toISOString() : null;

	return {
		aggregates: { callCount, totalTokens, totalCostUsd, lastEventAt },
		recentEvents: recent.map((e) => ({
			id: e.id,
			siteSlug: e.siteSlug,
			kind: e.kind,
			summary: e.summary,
			promptTokenCount: e.promptTokenCount,
			candidatesTokenCount: e.candidatesTokenCount,
			totalTokenCount: e.totalTokenCount,
			durationMs: e.durationMs,
			estimatedCostUsd: e.estimatedCostUsd,
			model: e.model,
			cachedContentTokenCount: e.cachedContentTokenCount,
			thoughtsTokenCount: e.thoughtsTokenCount,
			createdAt: e.createdAt.toISOString()
		}))
	};
}
