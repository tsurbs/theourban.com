import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function createMailMerge(obj: any, prefix: string = 'CONTENT_VAR_'): { template: any, mapping: Record<string, string> } {
	const mapping: Record<string, string> = {};
	let counter = 0;

	function walk(val: any): any {
		if (typeof val === 'string') {
			const isLikelyPath = val.startsWith('/') || val.startsWith('http');
			if (!isLikelyPath && val.length > 0) {
				const id = `${prefix}${counter++}`;
				mapping[id] = val;
				return `[[${id}]]`;
			}
			return val;
		}
		if (Array.isArray(val)) {
			return val.map(walk);
		}
		if (val !== null && typeof val === 'object') {
			const newObj: any = {};
			for (const key in val) {
				newObj[key] = walk(val[key]);
			}
			return newObj;
		}
		return val;
	}

	return { template: walk(obj), mapping };
}

export const POST: RequestHandler = async ({ request }) => {
	const API_KEY = env.OPENROUTER_API_KEY;

	if (!API_KEY) {
		return json({ error: 'Missing OPENROUTER_API_KEY in .env' }, { status: 500 });
	}

	let styleGuide = null;
	let feedbackHistory: string[] = [];
	let oldHtml = '';
	let slug = '';
	try {
		const body = await request.json();
		styleGuide = body.styleGuide || null;
		feedbackHistory = body.feedbackHistory || [];
		oldHtml = body.oldHtml || '';
		slug = body.slug || '';
	} catch {
		// Ignore bad JSON
	}

	const { template, mapping } = createMailMerge(content);

	try {
		const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'google/gemini-3.1-flash-lite-preview',
				reasoning: {
					"max_tokens": 0,
				},
				messages: [
					{
						role: 'system',
						content: `You are an expert UI developer. Create a beautiful, modern, single HTML file (with embedded CSS and JS) representing a complete, multi-page personal portfolio website as a Single Page Application (SPA).
						
INSTRUCTION:
Generate the layout using the provided JSON template. 
CRITICAL: The text content in the JSON has been replaced with placeholders like [[CONTENT_VAR_0]]. 
You MUST use these placeholders EXACTLY as they appear in the JSON template below whenever you need to render that specific piece of content. 
DO NOT invent text, do not fix "typos" (you can't see the text anyway), and DO NOT omit placeholders. 

Placeholders represent the actual user content that will be merged in after you generate the UI.

Here is the SITE DATA TEMPLATE: ${JSON.stringify(template, null, 2)}

${styleGuide ? `STYLE GUIDE: Follow these branding rules strictly: ${JSON.stringify(styleGuide, null, 2)}` : ''}
${oldHtml ? `CURRENT UI (Reference this for edits): [HTML provided below]` : ''}
${feedbackHistory.length > 0 ? `CRITICAL USER FEEDBACK HISTORY (Apply these changes/requests): ${feedbackHistory.join(' | ')}` : ''}

UI REQUIREMENTS:
1. Include a navigation menu that links to all pages. 
2. The site must be a TRUE Single Page Application: Navigation MUST NOT change the browser URL or cause a page reload. Use internal state (e.g., showing/hiding divs) or URL hashes (e.g., #about-me) to handle navigation.
3. Use modern design aesthetics: glassmorphism, subtle animations, great typography, responsive design.
4. CRITICAL IMAGE REQUIREMENT: You MUST use the exact absolute image URLs provided in the \`content\` JSON data. Do not make up image paths. Do not use relative paths.
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

		if (generatedHtml.startsWith('```html')) {
			generatedHtml = generatedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '');
		} else if (generatedHtml.startsWith('```')) {
			generatedHtml = generatedHtml.replace(/^```\n?/, '').replace(/\n?```$/, '');
		}

		// MAIL MERGE: Replace placeholders with actual content
		for (const [id, value] of Object.entries(mapping)) {
			const placeholder = `[[${id}]]`;
			const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(escapedPlaceholder, 'g');
			generatedHtml = generatedHtml.replace(regex, value);
		}

		if (slug) {
			await db.update(site)
				.set({
					generatedHtml,
					feedbackHistory,
					updatedAt: new Date()
				})
				.where(eq(site.slug, slug));
		}

		return json({ html: generatedHtml });

	} catch (err) {
		console.error("Error generating UI:", err);
		return json({ error: (err as Error).message || 'Failed to generate UI' }, { status: 500 });
	}
};
