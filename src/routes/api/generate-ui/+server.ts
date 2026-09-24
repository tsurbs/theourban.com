import type { RequestHandler } from './$types';
import content from '$lib/assets/content.json';
import { env } from '$env/dynamic/private';
import {
	geminiGenerateContent,
	geminiStreamGenerateContent,
	type GeminiUsage
} from '$lib/server/gemini';
import { buildGenerationCallStats } from '$lib/server/geminiPricing';
import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ensurePreviewContentSecurityPolicy } from '$lib/previewSecurity';
import { insertSiteGenerationEvent } from '$lib/server/siteGenerationEvents';
import { createMailMerge, mergePlaceholders } from '$lib/server/mailMerge';
import {
	extractHtmlDocument,
	findLeftoverPlaceholders,
	validateGeneratedHtml
} from '$lib/server/htmlOutput';
import type { GenerationCallStats } from '$lib/generationStats';

function sseEncode(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildSystemInstruction(options: {
	template: Record<string, unknown>;
	styleGuide: unknown;
	oldHtml: string;
	feedbackHistory: string[];
	repairNote?: string;
}): string {
	const { template, styleGuide, oldHtml, feedbackHistory, repairNote } = options;

	const sg =
		styleGuide && typeof styleGuide === 'object'
			? (styleGuide as Record<string, unknown>)
			: null;

	const layoutBits = sg
		? [
				sg.layoutArchetype && `layoutArchetype: ${sg.layoutArchetype}`,
				sg.signatureElement && `signatureElement: ${sg.signatureElement}`,
				sg.navigationStyle && `navigationStyle: ${sg.navigationStyle}`,
				sg.texture && `texture: ${sg.texture}`,
				sg.motion && `motion: ${sg.motion}`,
				sg.imageTreatment && `imageTreatment: ${sg.imageTreatment}`,
				sg.colorMode && `colorMode: ${sg.colorMode}`,
				sg.typeScale && `typeScale: ${sg.typeScale}`,
				sg.borderRadius && `borderRadius: ${sg.borderRadius}`
			]
				.filter(Boolean)
				.join('; ')
		: '';

	return `You are an expert UI developer. Create a beautiful, distinctive, single HTML file (with embedded CSS and JS) representing a complete, multi-page personal portfolio website as a Single Page Application (SPA).

INSTRUCTION:
Generate the layout using the provided JSON template.
CRITICAL: The text content in the JSON has been replaced with placeholders like [[CONTENT_VAR_0]].
You MUST use these placeholders EXACTLY as they appear in the JSON template below whenever you need to render that specific piece of content.
DO NOT invent text, do not fix "typos" (you can't see the text anyway), and DO NOT omit placeholders.

Placeholders represent the actual user content that will be merged in after you generate the UI.

Here is the SITE DATA TEMPLATE: ${JSON.stringify(template, null, 2)}

${styleGuide ? `STYLE GUIDE: Follow these branding rules strictly: ${JSON.stringify(styleGuide, null, 2)}` : ''}
${layoutBits ? `LAYOUT DIRECTION (mandatory): ${layoutBits}. Do NOT default to generic glassmorphism. Embody the layoutArchetype and signatureElement.` : ''}
${oldHtml ? `CURRENT UI (Reference this for edits): [HTML provided below]` : ''}
${feedbackHistory.length > 0 ? `CRITICAL USER FEEDBACK HISTORY (Apply these changes/requests): ${feedbackHistory.join(' | ')}` : ''}
${repairNote ? `REPAIR PASS: Previous output failed validation. You MUST fix: ${repairNote}` : ''}

RICH TEXT FIELDS:
The \`content\` field on each page is PRE-RENDERED HTML (paragraphs, lists, links, <i>, <sub>, <sup>, HTML entities, etc.). You MUST render it as HTML, never as plain text.
- Preferred: place the \`[[CONTENT_VAR_*]]\` placeholder for a page's \`content\` DIRECTLY inside an HTML element in the document body (e.g. <div class="page-body">[[CONTENT_VAR_17]]</div>). Do NOT put a content placeholder inside an HTML attribute, <title>, <script>, or any JS string literal.
- If you must store pages in JS for SPA routing, store the OTHER fields (title, slug, tags, cover_image) in JS, but keep each page's \`content\` placeholder inside a hidden HTML template element (e.g. <template data-page="scottylabs">[[CONTENT_VAR_17]]</template>) and clone/insert it with innerHTML / template.content when that page is shown. Never assign a content placeholder to .textContent.

UI REQUIREMENTS:
1. Include a navigation menu that links to all pages.
2. The site must be a TRUE Single Page Application: Navigation MUST NOT change the browser URL or cause a page reload. Use internal state (e.g., showing/hiding divs) or URL hashes (e.g., #about-me) to handle navigation.
3. Follow the style guide's layoutArchetype, signatureElement, motion, texture, and type treatments. Avoid a generic "AI glassmorphism" look unless the archetype calls for it. Great typography and responsive design are required.
4. CRITICAL IMAGE REQUIREMENT: You MUST use the exact absolute image URLs provided in the \`content\` JSON data. Do not make up image paths. Do not use relative paths.
5. All page/project images must be displayed with uniform sizing and consistent aspect ratios (e.g., using object-fit: cover) appropriate to the chosen archetype.
6. Provide ONLY the raw HTML code starting with <!DOCTYPE html>. Do not output markdown blocks like \`\`\`html.
7. CRITICAL: For all external links (starting with http), you MUST add the attribute target="_top" to ensure the link navigates out of the preview iframe.
8. Do not use the full site URL with target="_top" for internal portfolio or section navigation; use hash-based in-SPA navigation only for those views.`;
}

function processAndValidate(options: {
	raw: string;
	finishReason: string | null;
	mapping: ReturnType<typeof createMailMerge>['mapping'];
}): { ok: true; html: string } | { ok: false; issues: string[]; extracted: string } {
	const extracted = extractHtmlDocument(options.raw);
	const issues = validateGeneratedHtml({
		html: extracted,
		finishReason: options.finishReason,
		mapping: options.mapping,
		name: content.name,
		headline: content.headline
	});

	if (issues.length > 0) {
		return { ok: false, issues, extracted };
	}

	const merged = mergePlaceholders(extracted, options.mapping);
	const leftovers = findLeftoverPlaceholders(merged);
	if (leftovers.length > 0) {
		return {
			ok: false,
			issues: [`Leftover placeholders after merge: ${leftovers.join(', ')}`],
			extracted
		};
	}

	return { ok: true, html: ensurePreviewContentSecurityPolicy(merged) };
}

async function saveUiSuccess(options: {
	slug: string;
	html: string;
	feedbackHistory: string[];
	stats: GenerationCallStats | null;
}) {
	const { slug, html, feedbackHistory, stats } = options;
	if (slug) {
		await db
			.update(site)
			.set({
				generatedHtml: html,
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
}

/** Cheap follow-up call: one-sentence toast copy for feedback/regenerate paths. */
async function summarizeIterationChange(options: {
	apiKey: string;
	model: string;
	feedbackHistory: string[];
}): Promise<string | null> {
	const { apiKey, model, feedbackHistory } = options;
	if (feedbackHistory.length === 0) return null;

	const latest = feedbackHistory[feedbackHistory.length - 1]?.trim() ?? '';
	if (!latest) return null;

	const earlier = feedbackHistory
		.slice(0, -1)
		.map((s) => s.trim())
		.filter(Boolean);

	try {
		const result = await geminiGenerateContent({
			apiKey,
			model,
			systemInstruction:
				'You write one short sentence (max 16 words) summarizing a UI change for a toast. Past tense, plain language. No quotes, markdown, or preamble.',
			messages: [
				{
					role: 'user',
					content: earlier.length
						? `Earlier feedback (context only): ${earlier.join(' | ')}\nLatest request just applied: ${latest}\nSummarize only the latest change.`
						: `User feedback just applied: ${latest}\nSummarize what changed.`
				}
			],
			generationConfig: {
				temperature: 0.2,
				maxOutputTokens: 48
			}
		});

		const cleaned = result.text
			.trim()
			.replace(/^["'`]+|["'`]+$/g, '')
			.replace(/\s+/g, ' ')
			.slice(0, 160)
			.trim();
		return cleaned || null;
	} catch (err) {
		console.warn('changeSummary generation failed:', err);
		// Soft fallback so the toast still has something useful
		return latest.length > 120 ? `${latest.slice(0, 119)}…` : latest;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const API_KEY = env.AISTUDIO_API_KEY;
	const MODEL =
		env.AISTUDIO_UI_MODEL || env.AISTUDIO_MODEL || 'gemini-3.1-flash-lite-preview';

	if (!API_KEY) {
		return new Response(sseEncode('error', { error: 'Missing AISTUDIO_API_KEY in .env' }), {
			status: 500,
			headers: {
				'Content-Type': 'text/event-stream; charset=utf-8',
				'Cache-Control': 'no-cache, no-transform'
			}
		});
	}

	let styleGuide: unknown = null;
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

	const { template, mapping } = createMailMerge(content as Record<string, unknown>);
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(sseEncode(event, data)));
			};

			const t0 = Date.now();
			let totalUsage: GeminiUsage | null = null;
			let accumulatedMs = 0;

			const addUsage = (u: GeminiUsage | null, durationMs: number) => {
				accumulatedMs += durationMs;
				if (!u) return;
				if (!totalUsage) {
					totalUsage = { ...u };
					return;
				}
				totalUsage = {
					promptTokenCount: totalUsage.promptTokenCount + u.promptTokenCount,
					candidatesTokenCount: totalUsage.candidatesTokenCount + u.candidatesTokenCount,
					totalTokenCount: totalUsage.totalTokenCount + u.totalTokenCount,
					...(typeof u.cachedContentTokenCount === 'number' ||
					typeof totalUsage.cachedContentTokenCount === 'number'
						? {
								cachedContentTokenCount:
									(totalUsage.cachedContentTokenCount ?? 0) +
									(u.cachedContentTokenCount ?? 0)
							}
						: {}),
					...(typeof u.thoughtsTokenCount === 'number' ||
					typeof totalUsage.thoughtsTokenCount === 'number'
						? {
								thoughtsTokenCount:
									(totalUsage.thoughtsTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)
							}
						: {})
				};
			};

			try {
				const systemInstruction = buildSystemInstruction({
					template,
					styleGuide,
					oldHtml,
					feedbackHistory
				});

				const userMessage = oldHtml
					? `Here is the current HTML code of the site for your reference: \n\n${oldHtml}`
					: 'Generate the portfolio SPA HTML exactly as specified in the system instructions.';

				let rawText = '';
				let finishReason: string | null = null;
				const streamT0 = Date.now();

				for await (const ev of geminiStreamGenerateContent({
					apiKey: API_KEY,
					model: MODEL,
					systemInstruction,
					messages: [{ role: 'user', content: userMessage }],
					generationConfig: {
						temperature: 0.95,
						maxOutputTokens: 65536
					}
				})) {
					if (ev.type === 'chunk') {
						send('chunk', { text: ev.text });
					} else {
						rawText = ev.text;
						finishReason = ev.finishReason;
						addUsage(ev.usage, Date.now() - streamT0);
					}
				}

				let result = processAndValidate({ raw: rawText, finishReason, mapping });

				if (!result.ok) {
					send('chunk', {
						text: '',
						stage: 'repair',
						issues: result.issues
					});

					const repairInstruction = buildSystemInstruction({
						template,
						styleGuide,
						oldHtml,
						feedbackHistory,
						repairNote: result.issues.join('; ')
					});

					const repairT0 = Date.now();
					const repair = await geminiGenerateContent({
						apiKey: API_KEY,
						model: MODEL,
						systemInstruction: repairInstruction,
						messages: [
							{
								role: 'user',
								content:
									'Regenerate the full HTML document, fixing the listed validation issues. Output only raw HTML starting with <!DOCTYPE html>.'
							}
						],
						generationConfig: {
							temperature: 0.7,
							maxOutputTokens: 65536
						}
					});
					addUsage(repair.usage, Date.now() - repairT0);

					// Stream repair as one chunk for live preview refresh
					send('chunk', { text: repair.text });

					result = processAndValidate({
						raw: repair.text,
						finishReason: repair.finishReason,
						mapping
					});
				}

				if (!result.ok) {
					// Do NOT overwrite generatedHtml in DB
					send('error', {
						error: `UI validation failed: ${result.issues.join('; ')}`,
						issues: result.issues
					});
					controller.close();
					return;
				}

				const stats = buildGenerationCallStats(
					totalUsage,
					accumulatedMs || Date.now() - t0,
					MODEL
				);

				await saveUiSuccess({
					slug,
					html: result.html,
					feedbackHistory,
					stats
				});

				let changeSummary: string | null = null;
				if (feedbackHistory.length > 0) {
					changeSummary = await summarizeIterationChange({
						apiKey: API_KEY,
						model: MODEL,
						feedbackHistory
					});
				}

				send('done', {
					html: result.html,
					stats,
					...(changeSummary ? { changeSummary } : {})
				});
				controller.close();
			} catch (err) {
				console.error('Error generating UI:', err);
				send('error', {
					error: (err as Error).message || 'Failed to generate UI'
				});
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};
