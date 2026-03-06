import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	const API_KEY = env.OPENROUTER_API_KEY;

	if (!API_KEY) {
		return json({ error: 'Missing OPENROUTER_API_KEY in .env' }, { status: 500 });
	}

	let styleGuide = null;
	let feedbackHistory: string[] = [];
	let oldHtml = '';
	try {
		const body = await request.json();
		styleGuide = body.styleGuide || null;
		feedbackHistory = body.feedbackHistory || [];
		oldHtml = body.oldHtml || '';
	} catch {
		// Ignore bad JSON
	}

	try {
		const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				// Using the requested Gemini Flash Lite preview model
				model: 'google/gemini-3.1-flash-lite-preview',
				reasoning: {
					"max_tokens": 0,
				},
				messages: [
					{
						role: 'system',
						content: `You are an expert UI developer. Create a beautiful, modern, single HTML file (with embedded CSS and JS) representing a complete, multi-page personal portfolio website as a Single Page Application (SPA).
						
INSTRUCTION:
Generate the layout and content for EVERY page provided in the content data below.
The user should be able to navigate between all pages (About, Projects, etc.) without any page reloads.

Here is the FULL site data: ${JSON.stringify(content, null, 2)}
${styleGuide ? `STYLE GUIDE: Follow these branding rules strictly: ${JSON.stringify(styleGuide, null, 2)}` : ''}
${oldHtml ? `CURRENT UI (Reference this for edits): [HTML provided below]` : ''}
${feedbackHistory.length > 0 ? `CRITICAL USER FEEDBACK HISTORY (Apply these changes/requests): ${feedbackHistory.join(' | ')}` : ''}

UI REQUIREMENTS:
1. Include a navigation menu that links to all pages. 
2. The site must be a TRUE Single Page Application: Navigation MUST NOT change the browser URL or cause a page reload. Use internal state (e.g., showing/hiding divs) or URL hashes (e.g., #about-me) to handle navigation.
3. Use modern design aesthetics: glassmorphism, subtle animations, great typography, responsive design.
4. All images, fonts, and assets must be referenced using absolute paths provided in the content data (e.g., /pages/image.png). These are served from the static directory.
5. All page/project images must be displayed with uniform sizing and consistent aspect ratios (e.g., using object-fit: cover) to ensure a clean, grid-like or gallery aesthetic.
6. Provide ONLY the raw HTML code starting with <!DOCTYPE html>. Do not output markdown blocks like \`\`\`html.`
					},
					...(oldHtml ? [{
						role: 'user',
						content: `Here is the current HTML code of the site for your reference: \n\n${oldHtml}`
					}] : [])
				]
			})
		});

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`API returned ${res.status}: ${errText}`);
		}

		const data = await res.json();
		let generatedHtml = data.choices[0].message.content;

		// Clean up markdown block if the model included it despite instructions
		if (generatedHtml.startsWith('```html')) {
			generatedHtml = generatedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '');
		} else if (generatedHtml.startsWith('```')) {
			generatedHtml = generatedHtml.replace(/^```\n?/, '').replace(/\n?```$/, '');
		}

		return json({ html: generatedHtml });

	} catch (err) {
		console.error("Error generating UI:", err);
		return json({ error: (err as Error).message || 'Failed to generate UI' }, { status: 500 });
	}
};
