import { redirect, type Handle } from '@sveltejs/kit';

const BOT_USER_AGENTS = [
    'googlebot',
    'bingbot',
    'yandexbot',
    'duckduckbot',
    'baiduspider',
    'slackbot',
    'twitterbot',
    'facebookexternalhit',
    'facebot',
    'linkedinbot',
    'embedly',
    'quora link preview',
    'showyoubot',
    'outbrain',
    'pinterest/0.',
    'developers.google.com/+/web/snippet',
    'slack-imgproxy',
    'whatsapp',
    'flipboard',
    'tumblr',
    'bitlybot',
    'skypeuripreview',
    'nuzzel',
    'discordbot',
    'google-layout-tests',
    'google-ads-creatives-preview',
    'chrome-lighthouse',
    'google-read-aloud',
    'google-favicons',
    'applebot',
    'petalbot',
    'yandeximages',
    'yandexmobilebot',
    'yandexmetrika',
    'yandexvideo',
    'yandexcanvas'
];

export const handle: Handle = async ({ event, resolve }) => {
    const userAgent = event.request.headers.get('user-agent')?.toLowerCase() || '';
    const path = event.url.pathname;

    // Skip if it's already /robots, robots.txt, or a static asset/API
    const isRobotsRoute = path.startsWith('/robots');
    const isStaticFile = path.includes('.') || path.startsWith('/_app');
    const isApi = path.startsWith('/api');

    if (!isRobotsRoute && !isStaticFile && !isApi) {
        const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));

        if (isBot) {
            throw redirect(307, '/robots');
        }
    }

    return await resolve(event);
};
