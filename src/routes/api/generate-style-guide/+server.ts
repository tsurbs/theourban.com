import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';
import { geminiGenerateContent } from '$lib/server/gemini';
import { buildGenerationCallStats } from '$lib/server/geminiPricing';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';

// Word lists for generating a 3-word phrase (adjective + adjective + noun)
const adjectives = ['neon', 'vibrant', 'dark', 'minimal', 'brutalist', 'soft', 'sleek', 'bold', 'retro', 'modern', 'lucid', 'dreamy', 'stark', 'fluid', 'urban', 'cosmic', 'electric', 'pastel'];
const nouns = ['dreams', 'waves', 'pixels', 'vibes', 'horizons', 'echoes', 'visions', 'aesthetics', 'dynamics', 'flows', 'forms', 'structures', 'lights', 'shadows', 'spaces'];

function getRandomWord(list: string[]) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateThemeWords() {
    const adj1 = getRandomWord(adjectives);
    let adj2 = getRandomWord(adjectives);
    while (adj1 === adj2) {
        adj2 = getRandomWord(adjectives);
    }
    const noun = getRandomWord(nouns);
    return `${adj1} ${adj2} ${noun}`;
}


export const POST: RequestHandler = async ({ request }) => {
    const API_KEY = env.AISTUDIO_API_KEY;
    const MODEL = env.AISTUDIO_MODEL || 'gemini-3.1-flash-lite-preview';

    if (!API_KEY) {
        return json({ error: 'Missing AISTUDIO_API_KEY in .env' }, { status: 500 });
    }

    let customThemeWords = null;
    try {
        const body = await request.json();
        if (body && body.themeWords) customThemeWords = body.themeWords;
    } catch {
        // No body provided, use random
    }

    const themeWords = customThemeWords || generateThemeWords();
    const slug = themeWords.replace(/\s+/g, '-').toLowerCase();

    const systemInstruction = `JSON style guide only (no prose/fences). Keys: primaryColor,secondaryColor,backgroundColor,accentColor (hex), headingFont, bodyFont (Google names), spacingScale (short label), designSystemTheme (vibe phrase). Align palette+typography to theme: "${themeWords}"`;

    try {
        const t0 = Date.now();
        const { text: styleContentRaw, usage } = await geminiGenerateContent({
            apiKey: API_KEY,
            model: MODEL,
            systemInstruction,
            messages: [
                {
                    role: 'user',
                    content: JSON.stringify({ n: content.name, h: content.headline })
                }
            ]
        });
        let styleContent = styleContentRaw;
        const stats = buildGenerationCallStats(usage, Date.now() - t0);

        // Clean up markdown block if the model included it
        if (styleContent.startsWith('```json')) {
            styleContent = styleContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (styleContent.startsWith('```')) {
            styleContent = styleContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const styleGuide = JSON.parse(styleContent);

        // Save to DB (using upsert logic manually with Drizzle Postgres onConflictDoUpdate)
        await db.insert(site).values({
            slug,
            themeWords,
            styleGuide,
            // Empty initially until UI is generated
            generatedHtml: null,
            feedbackHistory: []
        }).onConflictDoUpdate({
            target: site.slug,
            set: {
                themeWords,
                styleGuide,
                updatedAt: new Date()
            }
        });

        return json({ slug, themeWords, styleGuide, stats });

    } catch (err) {
        console.error("Error generating style guide:", err);
        return json({ error: (err as Error).message || 'Failed to generate style guide' }, { status: 500 });
    }
};
