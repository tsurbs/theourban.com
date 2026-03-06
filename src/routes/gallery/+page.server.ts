import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    const allSites = await db.query.site.findMany({
        orderBy: [desc(site.createdAt)]
    });

    return {
        sites: allSites
    };
};
