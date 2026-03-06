import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
    const slug = params.slug;

    const dbSite = await db.query.site.findFirst({
        where: eq(site.slug, slug)
    });

    if (!dbSite) {
        // We create a shell "new" site representation to pass to the client
        return {
            isNew: true,
            site: {
                slug,
                themeWords: slug.replace(/-/g, ' '),
                styleGuide: null,
                generatedHtml: null,
                feedbackHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        };
    }

    return {
        isNew: false,
        site: dbSite
    };
};
