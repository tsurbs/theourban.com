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

// Keys whose string values are authored as HTML fragments in content.json and
// should be merged in as-is (not HTML-escaped) so paragraphs, lists, links,
// <i>/<sub>/<sup>, and named entities like &Sigma; render rather than appear
// as literal text. Extend this set if new HTML-bearing fields are added.
const HTML_VALUE_KEYS: ReadonlySet<string> = new Set(['content']);

type MergeEntry = { value: string; isHtml: boolean };

function createMailMerge(obj: Record<string, unknown>, prefix: string = 'CONTENT_VAR_'): { template: Record<string, unknown>, mapping: Record<string, MergeEntry> } {
	const mapping: Record<string, MergeEntry> = {};
	let counter = 0;

	function walk(val: unknown, parentKey?: string): unknown {
		if (typeof val === 'string') {
			const isLikelyPath = val.startsWith('/') || val.startsWith('http');
			if (!isLikelyPath && val.length > 0) {
				const id = `${prefix}${counter++}`;
				mapping[id] = {
					value: val,
					isHtml: parentKey != null && HTML_VALUE_KEYS.has(parentKey)
				};
				return `[[${id}]]`;
			}
			return val;
		}
		if (Array.isArray(val)) {
			return val.map((item) => walk(item, parentKey));
		}
		if (val !== null && typeof val === 'object') {
			const newObj: Record<string, unknown> = {};
			const typedVal = val as Record<string, unknown>;
			for (const key in typedVal) {
				newObj[key] = walk(typedVal[key], key);
			}
			return newObj;
		}
		return val;
	}

	return { template: walk(obj) as Record<string, unknown>, mapping };
}

/**
 * Decide whether a given placeholder occurrence is in an HTML text-node
 * context (between tags) vs. an unsafe-for-raw-HTML context (inside an
 * attribute value, inside <script>/<style>/<title>, etc.).
 *
 * Heuristics, scanning the document up to `index`:
 *  - If we're inside <script>, <style>, or <title> (no closing tag yet for the
 *    most recent opener) → not text-node.
 *  - Else, find the last unquoted '<' or '>' before `index`. If '>' wins, we
 *    are between tags → text-node. If '<' wins, we are inside a tag (attrs).
 */
function isHtmlTextNodeContext(html: string, index: number): boolean {
	const upto = html.slice(0, index);
	const lowered = upto.toLowerCase();

	for (const tag of ['script', 'style', 'title']) {
		const openIdx = lowered.lastIndexOf(`<${tag}`);
		if (openIdx === -1) continue;
		const closeIdx = lowered.lastIndexOf(`</${tag}`);
		if (closeIdx < openIdx) return false;
	}

	const lastGt = upto.lastIndexOf('>');
	const lastLt = upto.lastIndexOf('<');
	if (lastLt === -1) return true;
	return lastGt > lastLt;
}

function mergePlaceholders(html: string, mapping: Record<string, MergeEntry>): string {
	const placeholderRe = /\[\[(CONTENT_VAR_\d+)\]\]/g;
	return html.replace(placeholderRe, (match, id: string, offset: number) => {
		const entry = mapping[id];
		if (!entry) return match;
		if (entry.isHtml && isHtmlTextNodeContext(html, offset)) {
			return entry.value;
		}
		return escapeHtmlForMailMerge(entry.value);
	});
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

RICH TEXT FIELDS:
The \`content\` field on each page is PRE-RENDERED HTML (paragraphs, lists, links, <i>, <sub>, <sup>, HTML entities, etc.). You MUST render it as HTML, never as plain text.
- Preferred: place the \`[[CONTENT_VAR_*]]\` placeholder for a page's \`content\` DIRECTLY inside an HTML element in the document body (e.g. <div class="page-body">[[CONTENT_VAR_17]]</div>). Do NOT put a content placeholder inside an HTML attribute, <title>, <script>, or any JS string literal.
- If you must store pages in JS for SPA routing, store the OTHER fields (title, slug, tags, cover_image) in JS, but keep each page's \`content\` placeholder inside a hidden HTML template element (e.g. <template data-page="scottylabs">[[CONTENT_VAR_17]]</template>) and clone/insert it with innerHTML / template.content when that page is shown. Never assign a content placeholder to .textContent.

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

		// MAIL MERGE: Replace placeholders with actual content. HTML-bearing
		// fields (see HTML_VALUE_KEYS) inject raw markup only when the
		// placeholder lands in an HTML text-node context; in attribute / JS
		// string / <title> / <script> / <style> contexts we fall back to
		// escaping so we never break surrounding syntax.
		generatedHtml = mergePlaceholders(generatedHtml, mapping);

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
