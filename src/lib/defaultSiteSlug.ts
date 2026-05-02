import { env } from '$env/dynamic/public';

const FALLBACK = 'default-landing-page';

/** URL slug that `/` redirects to. Set `PUBLIC_DEFAULT_SITE_SLUG` in `.env`. */
export function getDefaultSiteSlug(): string {
	const v = env.PUBLIC_DEFAULT_SITE_SLUG?.trim();
	return v || FALLBACK;
}
