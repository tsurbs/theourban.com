import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DEFAULT_SITE = '/default-landing-page';

export const load: PageServerLoad = async () => {
	throw redirect(303, DEFAULT_SITE);
};
