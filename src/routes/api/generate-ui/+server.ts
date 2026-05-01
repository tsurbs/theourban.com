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

function createMailMerge(obj: Record<string, unknown>, prefix: string = 'V'): { template: Record<string, unknown>, mapping: Record<string, string> } {
	const mapping: Record<string, string> = {};
	let counter = 0;

	function walk(val: unknown, fieldKey?: string): unknown {
		if (typeof val === 'string') {
			const isLikelyPath = val.startsWith('/') || val.startsWith('http');
			const isTrivial = /^\d{1,3}$/.test(val);
			const isNavSlug = fieldKey === 'slug' && /^[a-z0-9-]+$/i.test(val);
			if (!isLikelyPath && !isTrivial && !isNavSlug && val.length > 0) {
				const id = `${prefix}${counter++}`;
				mapping[id] = val;
				return `[[${id}]]`;
			}
			return val;
		}
		if (Array.isArray(val)) {
			return val.map((item) => walk(item));
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
	const tmpl = JSON.stringify(template);
	const brand = styleGuide ? JSON.stringify(styleGuide) : '';
	const fb =
		feedbackHistory.length > 0 ? feedbackHistory.join(' | ') : '';

	const systemInstruction = `Single-file portfolio SPA HTML+CSS+JS. Start with <!DOCTYPE html>, no markdown fence.
Emit every [[V0]],[[V1]],… placeholder from T verbatim (user text merges later); don't drop or substitute.
T:${tmpl}${brand ? `\nBrand:${brand}` : ''}${fb ? `\nEdits:${fb}` : ''}
Nav→all sections. Hash or toggle views only (no reload/URL takeover). Glassy/modern/responsive.
Img src=take from T paths/URLs unchanged. Uniform thumbs (object-fit:cover). Links with http/mailto: target="_top".${oldHtml ? '\nRef prior HTML in next user msg.' : ''}`;

	try {
		const t0 = Date.now();
		const { text: generatedHtmlRaw, usage } = await geminiGenerateContent({
			apiKey: API_KEY,
			model: MODEL,
			systemInstruction,
			messages: oldHtml
				? [{ role: 'user', content: `Prior:\n${oldHtml}` }]
				: [{ role: 'user', content: 'Build.' }]
		});
		let generatedHtml = generatedHtmlRaw;
		const stats = buildGenerationCallStats(usage, Date.now() - t0);

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

		return json({ html: generatedHtml, stats });

	} catch (err) {
		console.error("Error generating UI:", err);
		return json({ error: (err as Error).message || 'Failed to generate UI' }, { status: 500 });
	}
};
