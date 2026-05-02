import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';
import { geminiGenerateContent } from '$lib/server/gemini';
import { buildGenerationCallStats } from '$lib/server/geminiPricing';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { insertSiteGenerationEvent } from '$lib/server/siteGenerationEvents';

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

    const systemInstruction = `You are a world-class brand designer. Based on the provided portfolio data and a specific theme, create a cohesive and premium-feeling "Style Guide" in JSON format.
The style guide should include:
- primaryColor (hex)
- secondaryColor (hex)
- backgroundColor (hex)
- accentColor (hex)
- headingFont (Google Font name)
- bodyFont (Google Font name / Sans-serif fallback)
- spacingScale (a short descriptive name for spacing tightness)
- designSystemTheme (a string describing the vibe, e.g., "Minimalist High-Contrast", "Vibrant Brutalist", "Soft neumorphism")

CRITICAL INSTRUCTION: Base the entire style guide identity and colors around this specific theme phrase: "${themeWords}"

Reply ONLY with the raw JSON object. Do not include markdown formatting or explanations.`;

    try {
        const t0 = Date.now();
        const { text: styleContentRaw, usage } = await geminiGenerateContent({
            apiKey: API_KEY,
            model: MODEL,
            systemInstruction,
            messages: [
                {
                    role: 'user',
                    content: JSON.stringify({ name: content.name, headline: content.headline }, null, 2)
                }
            ]
        });
        let styleContent = styleContentRaw;
        const stats = buildGenerationCallStats(usage, Date.now() - t0, MODEL);

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

        if (stats) {
            await insertSiteGenerationEvent({
                siteSlug: slug,
                kind: 'style-guide',
                summary: `Theme: ${themeWords}`,
                stats
            });
        }

        return json({ slug, themeWords, styleGuide, stats });

    } catch (err) {
        console.error("Error generating style guide:", err);
        return json({ error: (err as Error).message || 'Failed to generate style guide' }, { status: 500 });
    }
};
