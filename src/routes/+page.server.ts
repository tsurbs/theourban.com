import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDefaultSiteSlug } from '$lib/defaultSiteSlug';

export const load: PageServerLoad = async () => {
	throw redirect(303, `/${getDefaultSiteSlug()}`);
};
