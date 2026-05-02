import type { PageServerLoad } from './$types';
import { getDefaultSiteSlug } from '$lib/defaultSiteSlug';

export const load: PageServerLoad = async ({ url }) => {
	return { siteOrigin: url.origin, defaultSiteSlug: getDefaultSiteSlug() };
};
