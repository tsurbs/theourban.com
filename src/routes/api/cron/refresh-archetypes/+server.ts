import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { geminiGenerateContent } from '$lib/server/gemini';
import { db } from '$lib/server/db';
import { designArchetype } from '$lib/server/db/schema';
import {
	getActiveArchetypes,
	invalidateArchetypeCache,
	SEED_ARCHETYPES
} from '$lib/server/designDirections';

const ARCHETYPE_BATCH_SCHEMA: Record<string, unknown> = {
	type: 'OBJECT',
	properties: {
		archetypes: {
			type: 'ARRAY',
			items: {
				type: 'OBJECT',
				properties: {
					key: { type: 'STRING' },
					label: { type: 'STRING' },
					description: { type: 'STRING' }
				},
				required: ['key', 'label', 'description']
			}
		}
	},
	required: ['archetypes']
};

function authorizeCron(request: Request): boolean {
	const secret = env.CRON_SECRET;
	if (!secret) return false;
	const auth = request.headers.get('authorization');
	if (auth === `Bearer ${secret}`) return true;
	// Vercel Cron may also send ?token= or x-vercel-cron — Bearer is the documented pattern
	const url = new URL(request.url);
	if (url.searchParams.get('secret') === secret) return true;
	return false;
}

function slugifyKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

async function refreshArchetypes(): Promise<Response> {
	const API_KEY = env.AISTUDIO_API_KEY;
	const MODEL =
		env.AISTUDIO_ARCHETYPE_MODEL ||
		env.AISTUDIO_UI_MODEL ||
		env.AISTUDIO_MODEL ||
		'gemini-3.1-flash-lite-preview';

	if (!API_KEY) {
		return json({ error: 'Missing AISTUDIO_API_KEY' }, { status: 500 });
	}

	const existing = await getActiveArchetypes();
	const existingKeys = existing.map((a) => a.key);
	const existingSummaries = existing
		.map((a) => `- ${a.key}: ${a.label} — ${a.description.slice(0, 120)}`)
		.join('\n');

	const systemInstruction = `You invent distinctive website layout archetypes for generative portfolio design.
Return JSON with 3 to 5 NEW archetypes that are clearly different from the existing list.
Each archetype needs:
- key: kebab-case unique id (letters, numbers, hyphens only)
- label: short human title
- description: 1–3 sentences of prompt-ready layout direction (structure, typography, chrome, navigation feel)

Do NOT repeat or lightly rephrase existing keys or concepts.
Existing archetypes:
${existingSummaries || '(none)'}

Forbidden keys: ${existingKeys.join(', ') || '(none)'}`;

	const { text } = await geminiGenerateContent({
		apiKey: API_KEY,
		model: MODEL,
		systemInstruction,
		messages: [
			{
				role: 'user',
				content: 'Invent 3–5 new layout archetypes as JSON.'
			}
		],
		generationConfig: {
			temperature: 1.2,
			responseMimeType: 'application/json',
			responseSchema: ARCHETYPE_BATCH_SCHEMA
		}
	});

	let parsed: { archetypes?: Array<{ key?: string; label?: string; description?: string }> };
	try {
		parsed = JSON.parse(text) as typeof parsed;
	} catch {
		return json({ error: 'Failed to parse archetype JSON', raw: text.slice(0, 500) }, { status: 502 });
	}

	const known = new Set([
		...existingKeys,
		...SEED_ARCHETYPES.map((s) => s.key)
	]);

	const created: string[] = [];
	const skipped: string[] = [];

	for (const item of parsed.archetypes ?? []) {
		if (!item?.key || !item.label || !item.description) {
			skipped.push('(incomplete)');
			continue;
		}
		const key = slugifyKey(item.key);
		if (!key || known.has(key)) {
			skipped.push(item.key);
			continue;
		}
		if (item.description.trim().length < 40) {
			skipped.push(key);
			continue;
		}

		await db
			.insert(designArchetype)
			.values({
				key,
				label: item.label.trim().slice(0, 120),
				description: item.description.trim().slice(0, 2000),
				active: true,
				source: 'cron',
				model: MODEL
			})
			.onConflictDoUpdate({
				target: designArchetype.key,
				set: {
					label: item.label.trim().slice(0, 120),
					description: item.description.trim().slice(0, 2000),
					active: true,
					source: 'cron',
					model: MODEL
				}
			});

		known.add(key);
		created.push(key);
	}

	invalidateArchetypeCache();

	// No site_slug FK available for cron jobs — skip insertSiteGenerationEvent.
	return json({
		ok: true,
		model: MODEL,
		created,
		skipped,
		totalActive: (await getActiveArchetypes()).length
	});
}

export const GET: RequestHandler = async ({ request }) => {
	if (!authorizeCron(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		return await refreshArchetypes();
	} catch (err) {
		console.error('refresh-archetypes cron failed:', err);
		return json({ error: (err as Error).message || 'Cron failed' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!authorizeCron(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		return await refreshArchetypes();
	} catch (err) {
		console.error('refresh-archetypes cron failed:', err);
		return json({ error: (err as Error).message || 'Cron failed' }, { status: 500 });
	}
};
