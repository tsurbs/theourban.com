import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveArchetypes, SEED_ARCHETYPES } from '$lib/server/designDirections';

/** Public list of layout archetypes for the /new picker (keys + labels). */
export const GET: RequestHandler = async () => {
	try {
		const all = await getActiveArchetypes();
		return json({
			archetypes: all.map((a) => ({ key: a.key, label: a.label }))
		});
	} catch {
		return json({
			archetypes: SEED_ARCHETYPES.map((a) => ({ key: a.key, label: a.label }))
		});
	}
};
