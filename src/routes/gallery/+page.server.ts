import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
    const allSites = await db.query.site.findMany({
        orderBy: [desc(site.thumbsUps), desc(site.createdAt)]
    });

    return {
        sites: allSites
    };
};

export const actions: Actions = {
    thumbsUp: async ({ request }) => {
        const formData = await request.formData();
        const slug = formData.get('slug') as string;

        if (!slug) {
            return fail(400, { message: 'Missing slug' });
        }

        try {
            await db.update(site)
                .set({
                    thumbsUps: sql`${site.thumbsUps} + 1`,
                    updatedAt: new Date()
                })
                .where(eq(site.slug, slug));

            return { success: true };
        } catch (error) {
            console.error('Error updating thumbs up:', error);
            return fail(500, { message: 'Failed to update thumbs up' });
        }
    }
};
