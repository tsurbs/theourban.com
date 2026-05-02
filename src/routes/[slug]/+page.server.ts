import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getNerdStatsForSiteSlug } from '$lib/server/siteGenerationEvents';

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.slug;
	const previewFrame = { previewOrigin: url.origin, previewPathname: url.pathname };

	const dbSite = await db.query.site.findFirst({
		where: eq(site.slug, slug),
	});

	const nerdGlobal = await getNerdStatsForSiteSlug(slug);

	if (!dbSite) {
		return {
			isNew: true,
			site: {
				slug,
				themeWords: slug.replace(/-/g, ' '),
				styleGuide: null,
				generatedHtml: null,
				feedbackHistory: [],
				thumbsUps: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			nerdGlobal,
			...previewFrame,
		};
	}

	return {
		isNew: false,
		site: dbSite,
		nerdGlobal,
		...previewFrame,
	};
};
