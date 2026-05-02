import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNerdStatsForSiteSlug } from '$lib/server/siteGenerationEvents';

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug;
	if (!slug) {
		return json({ error: 'Missing slug' }, { status: 400 });
	}
	const nerdGlobal = await getNerdStatsForSiteSlug(slug);
	return json(nerdGlobal);
};
