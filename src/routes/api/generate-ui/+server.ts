import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';
import { geminiGenerateContent } from '$lib/server/gemini';
import { buildGenerationCallStats } from '$lib/server/geminiPricing';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ensurePreviewContentSecurityPolicy, escapeHtmlForMailMerge } from '$lib/previewSecurity';
import { insertSiteGenerationEvent } from '$lib/server/siteGenerationEvents';

function createMailMerge(obj: Record<string, unknown>, prefix: string = 'CONTENT_VAR_'): { template: Record<string, unknown>, mapping: Record<string, string> } {
	const mapping: Record<string, string> = {};
	let counter = 0;

	function walk(val: unknown): unknown {
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
			const newObj: Record<string, unknown> = {};
			const typedVal = val as Record<string, unknown>;
			for (const key in typedVal) {
				newObj[key] = walk(typedVal[key]);
			}
			return newObj;
		}
		return val;
	}

	return { template: walk(obj) as Record<string, unknown>, mapping };
}

export const POST: RequestHandler = async ({ request }) => {
	const API_KEY = env.AISTUDIO_API_KEY;
	const MODEL = env.AISTUDIO_MODEL || 'gemini-3.1-flash-lite-preview';

	if (!API_KEY) {
		return json({ error: 'Missing AISTUDIO_API_KEY in .env' }, { status: 500 });
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

	const systemInstruction = `You are an expert UI developer. Create a beautiful, modern, single HTML file (with embedded CSS and JS) representing a complete, multi-page personal portfolio website as a Single Page Application (SPA).
						
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
6. Provide ONLY the raw HTML code starting with <!DOCTYPE html>. Do not output markdown blocks like \`\`\`html.
7. CRITICAL: For all external links (starting with http), you MUST add the attribute target="_top" to ensure the link navigates out of the preview iframe.
8. Do not use the full site URL with target="_top" for internal portfolio or section navigation; use hash-based in-SPA navigation only for those views.`;

	try {
		const t0 = Date.now();
		const { text: generatedHtmlRaw, usage } = await geminiGenerateContent({
			apiKey: API_KEY,
			model: MODEL,
			systemInstruction,
			messages: oldHtml
				? [{ role: 'user', content: `Here is the current HTML code of the site for your reference: \n\n${oldHtml}` }]
				: [{ role: 'user', content: 'Generate the portfolio SPA HTML exactly as specified in the system instructions.' }]
		});
		let generatedHtml = generatedHtmlRaw;
		const stats = buildGenerationCallStats(usage, Date.now() - t0, MODEL);

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
			generatedHtml = generatedHtml.replace(regex, escapeHtmlForMailMerge(value));
		}

		generatedHtml = ensurePreviewContentSecurityPolicy(generatedHtml);

		if (slug) {
			await db.update(site)
				.set({
					generatedHtml,
					feedbackHistory,
					updatedAt: new Date()
				})
				.where(eq(site.slug, slug));
		}

		if (stats && slug) {
			const summary =
				feedbackHistory.length > 0
					? `Feedback: ${feedbackHistory[feedbackHistory.length - 1]}`
					: 'Initial UI generation';
			await insertSiteGenerationEvent({
				siteSlug: slug,
				kind: 'ui',
				summary,
				stats
			});
		}

		return json({ html: generatedHtml, stats });

	} catch (err) {
		console.error("Error generating UI:", err);
		return json({ error: (err as Error).message || 'Failed to generate UI' }, { status: 500 });
	}
};
