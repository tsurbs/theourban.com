import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import defaultLandingHtml from '$lib/assets/default-landing-page.snapshot.html?raw';
import defaultLandingBundle from '$lib/assets/default-landing-page.meta.json';

const FALLBACK_SLUG = 'default-landing-page';

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.slug;
	const previewFrame = { previewOrigin: url.origin, previewPathname: url.pathname };

	const dbSite = await db.query.site.findFirst({
		where: eq(site.slug, slug),
	});

	if (slug === FALLBACK_SLUG) {
		if (dbSite?.generatedHtml) {
			return {
				isNew: false,
				site: dbSite,
				...previewFrame,
			};
		}
		return {
			isNew: false,
			site: {
				slug: FALLBACK_SLUG,
				themeWords: defaultLandingBundle.themeWords,
				styleGuide: defaultLandingBundle.styleGuide,
				generatedHtml: defaultLandingHtml,
				feedbackHistory: dbSite?.feedbackHistory ?? [],
				thumbsUps: dbSite?.thumbsUps ?? 0,
				createdAt: dbSite?.createdAt ?? new Date(),
				updatedAt: dbSite?.updatedAt ?? new Date(),
			},
			...previewFrame,
		};
	}

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
			...previewFrame,
		};
	}

	return {
		isNew: false,
		site: dbSite,
		...previewFrame,
	};
};
