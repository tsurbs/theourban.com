import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async () => {
    const API_KEY = env.OPENROUTER_API_KEY;

    if (!API_KEY) {
        return json({ error: 'Missing OPENROUTER_API_KEY in .env' }, { status: 500 });
    }

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-3.1-flash-lite-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are a world-class brand designer. Based on the provided portfolio data, create a cohesive and premium-feeling "Style Guide" in JSON format.
The style guide should include:
- primaryColor (hex)
- secondaryColor (hex)
- backgroundColor (hex)
- accentColor (hex)
- headingFont (Google Font name)
- bodyFont (Google Font name / Sans-serif fallback)
- spacingScale (a short descriptive name for spacing tightness)
- designSystemTheme (a string describing the vibe, e.g., "Minimalist High-Contrast", "Vibrant Brutalist", "Soft neumorphism")

Reply ONLY with the raw JSON object. Do not include markdown formatting or explanations.`
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({ name: content.name, headline: content.headline }, null, 2)
                    }
                ]
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API returned ${res.status}: ${errText}`);
        }

        const data = await res.json();
        let styleContent = data.choices[0].message.content;

        // Clean up markdown block if the model included it
        if (styleContent.startsWith('```json')) {
            styleContent = styleContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (styleContent.startsWith('```')) {
            styleContent = styleContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const styleGuide = JSON.parse(styleContent);
        return json({ styleGuide });

    } catch (err) {
        console.error("Error generating style guide:", err);
        return json({ error: (err as Error).message || 'Failed to generate style guide' }, { status: 500 });
    }
};
