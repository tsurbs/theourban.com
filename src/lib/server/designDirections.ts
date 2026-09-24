import { db } from '$lib/server/db';
import { designArchetype } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export type DesignArchetype = {
	key: string;
	label: string;
	description: string;
};

/** Seed archetypes — always available as fallback / merge base. */
export const SEED_ARCHETYPES: readonly DesignArchetype[] = [
	{
		key: 'editorial-magazine',
		label: 'Editorial magazine',
		description:
			'Magazine-style editorial layout: strong masthead, pull quotes, multi-column body, oversized display type, and asymmetric image placements.'
	},
	{
		key: 'bento-grid',
		label: 'Bento grid',
		description:
			'Tight modular bento/mosaic grid of uneven tiles; each project is a tile with cropped imagery and short labels; clear visual hierarchy by tile size.'
	},
	{
		key: 'terminal-cli',
		label: 'Terminal / CLI',
		description:
			'Monospace terminal/CLI aesthetic: command prompts, ASCII-adjacent frames, dark panel chrome, typed commands for navigation, scanline or phosphor feel.'
	},
	{
		key: 'swiss-grid',
		label: 'Swiss grid',
		description:
			'International Typographic Style: strict modular grid, Helvetica-like grotesk, flush-left hierarchy, lots of white space, restrained color accents.'
	},
	{
		key: 'brutalist-poster',
		label: 'Brutalist poster',
		description:
			'Raw brutalist poster energy: huge type, harsh contrast, visible seams, overlapping blocks, anti-polish edges, intentional awkwardness.'
	},
	{
		key: 'scrapbook-collage',
		label: 'Scrapbook / collage',
		description:
			'Scrapbook collage: tape, polaroids, tilted photos, handwritten labels, layered paper textures, playful imperfect alignment.'
	},
	{
		key: 'docs-sidebar',
		label: 'Docs-style sidebar',
		description:
			'Documentation site pattern: left sticky sidebar TOC, content column, code-ish typography, muted neutrals, crisp section anchors.'
	},
	{
		key: 'horizontal-scroll',
		label: 'Horizontal scroll',
		description:
			'Primarily horizontal storytelling: side-scrolling panels or snap sections, wide cinematic frames, vertical scroll minimized to essentials.'
	},
	{
		key: 'zine',
		label: 'Zine',
		description:
			'DIY photocopied zine: xerox grain, cut-and-paste headlines, irregular columns, stamp marks, high-contrast black/white with one ink accent.'
	},
	{
		key: 'retro-os-windows',
		label: 'Retro OS windows',
		description:
			'Retro desktop OS windows: title bars, overlapping window chrome, icon grid, system fonts, desktop wallpaper behind floating portfolio windows.'
	},
	{
		key: 'minimalist-column',
		label: 'Minimalist single column',
		description:
			'Ultra-minimal single column: generous leading, restrained palette, almost no chrome, typography-first, quiet hover states only.'
	},
	{
		key: 'card-stack',
		label: 'Card stack',
		description:
			'Stacked or swipeable card deck for projects: one focal card at a time, depth shadows or peel transitions, compact meta on the face of each card.'
	}
] as const;

export const adjectives = [
	'neon',
	'vibrant',
	'dark',
	'minimal',
	'brutalist',
	'soft',
	'sleek',
	'bold',
	'retro',
	'modern',
	'lucid',
	'dreamy',
	'stark',
	'fluid',
	'urban',
	'cosmic',
	'electric',
	'pastel',
	'muted',
	'luminous',
	'grainy',
	'glossy',
	'matte',
	'crystalline',
	'foggy',
	'sunbleached',
	'midnight',
	'ivory',
	'copper',
	'ceramic',
	'woven',
	'pixelated',
	'analog',
	'digital',
	'kinetic',
	'still',
	'warm',
	'cool',
	'acid',
	'earthy',
	'opaline',
	'inked',
	'chalky',
	'satin',
	'velvet',
	'raw',
	'polished',
	'ornate',
	'sparse',
	'dense',
	'whispered',
	'thunderous',
	'coastal',
	'alpine',
	'nocturnal',
	'diurnal',
	'iridescent',
	'monochrome',
	'duotone',
	'triadic'
];

export const nouns = [
	'dreams',
	'waves',
	'pixels',
	'vibes',
	'horizons',
	'echoes',
	'visions',
	'aesthetics',
	'dynamics',
	'flows',
	'forms',
	'structures',
	'lights',
	'shadows',
	'spaces',
	'signals',
	'currents',
	'circuits',
	'mosaics',
	'lattices',
	'archives',
	'fragments',
	'portals',
	'ateliers',
	'studios',
	'galleries',
	'blueprints',
	'sketches',
	'canvases',
	'frames',
	'pulses',
	'rhythms',
	'orbits',
	'constellations',
	'terrains',
	'coastlines',
	'skylines',
	'interiors',
	'exteriors',
	'thresholds',
	'corridors',
	'plazas',
	'gardens',
	'machines',
	'instruments',
	'palettes',
	'textures',
	'gradients',
	'overlays',
	'layers',
	'grids',
	'modules',
	'panels',
	'posters',
	'folios',
	'journals',
	'manifestos',
	'protocols',
	'indexes',
	'atlases'
];

function getRandomWord(list: string[]) {
	return list[Math.floor(Math.random() * list.length)]!;
}

export function generateThemeWords(): string {
	const adj1 = getRandomWord(adjectives);
	let adj2 = getRandomWord(adjectives);
	while (adj1 === adj2) {
		adj2 = getRandomWord(adjectives);
	}
	const noun = getRandomWord(nouns);
	return `${adj1} ${adj2} ${noun}`;
}

/** Letters, numbers, spaces, hyphens; max 60 chars. */
export function sanitizeThemeWords(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
	if (!trimmed) return null;
	if (!/^[a-zA-Z0-9 -]+$/.test(trimmed)) return null;
	return trimmed;
}

export function themeWordsToSlug(themeWords: string): string {
	return themeWords.replace(/\s+/g, '-').toLowerCase();
}

/** Gemini JSON responseSchema for style guides. */
export const STYLE_GUIDE_RESPONSE_SCHEMA: Record<string, unknown> = {
	type: 'OBJECT',
	properties: {
		primaryColor: { type: 'STRING' },
		secondaryColor: { type: 'STRING' },
		backgroundColor: { type: 'STRING' },
		accentColor: { type: 'STRING' },
		headingFont: { type: 'STRING' },
		bodyFont: { type: 'STRING' },
		spacingScale: { type: 'STRING' },
		designSystemTheme: { type: 'STRING' },
		layoutArchetype: { type: 'STRING' },
		navigationStyle: { type: 'STRING' },
		colorMode: { type: 'STRING' },
		typeScale: { type: 'STRING' },
		borderRadius: { type: 'STRING' },
		texture: { type: 'STRING' },
		motion: { type: 'STRING' },
		imageTreatment: { type: 'STRING' },
		signatureElement: { type: 'STRING' }
	},
	required: [
		'primaryColor',
		'secondaryColor',
		'backgroundColor',
		'accentColor',
		'headingFont',
		'bodyFont',
		'spacingScale',
		'designSystemTheme',
		'layoutArchetype',
		'navigationStyle',
		'colorMode',
		'typeScale',
		'borderRadius',
		'texture',
		'motion',
		'imageTreatment',
		'signatureElement'
	]
};

export type StyleGuide = {
	primaryColor: string;
	secondaryColor: string;
	backgroundColor: string;
	accentColor: string;
	headingFont: string;
	bodyFont: string;
	spacingScale: string;
	designSystemTheme: string;
	layoutArchetype: string;
	navigationStyle: string;
	colorMode: string;
	typeScale: string;
	borderRadius: string;
	texture: string;
	motion: string;
	imageTreatment: string;
	signatureElement: string;
};

export function parseStyleGuide(raw: unknown): StyleGuide | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const req = [
		'primaryColor',
		'secondaryColor',
		'backgroundColor',
		'accentColor',
		'headingFont',
		'bodyFont',
		'spacingScale',
		'designSystemTheme',
		'layoutArchetype',
		'navigationStyle',
		'colorMode',
		'typeScale',
		'borderRadius',
		'texture',
		'motion',
		'imageTreatment',
		'signatureElement'
	] as const;
	for (const key of req) {
		if (typeof o[key] !== 'string' || !(o[key] as string).trim()) return null;
	}
	return o as unknown as StyleGuide;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedArchetypes: DesignArchetype[] | null = null;
let cacheExpiresAt = 0;

export function invalidateArchetypeCache() {
	cachedArchetypes = null;
	cacheExpiresAt = 0;
}

function mergeArchetypes(dbRows: DesignArchetype[]): DesignArchetype[] {
	const byKey = new Map<string, DesignArchetype>();
	for (const seed of SEED_ARCHETYPES) {
		byKey.set(seed.key, seed);
	}
	for (const row of dbRows) {
		byKey.set(row.key, row);
	}
	return [...byKey.values()];
}

/** Active DB archetypes merged with seeds, deduped by key. Short in-memory cache. */
export async function getActiveArchetypes(): Promise<DesignArchetype[]> {
	const now = Date.now();
	if (cachedArchetypes && now < cacheExpiresAt) {
		return cachedArchetypes;
	}

	let dbRows: DesignArchetype[] = [];
	try {
		const rows = await db
			.select({
				key: designArchetype.key,
				label: designArchetype.label,
				description: designArchetype.description
			})
			.from(designArchetype)
			.where(eq(designArchetype.active, true));
		dbRows = rows;
	} catch (err) {
		console.warn('getActiveArchetypes: DB unavailable, using seeds only', err);
	}

	const merged = mergeArchetypes(dbRows);
	cachedArchetypes = merged;
	cacheExpiresAt = now + CACHE_TTL_MS;
	return merged;
}

export async function resolveArchetype(
	keyOrNull: string | null | undefined
): Promise<DesignArchetype | null> {
	const all = await getActiveArchetypes();
	if (keyOrNull) {
		return all.find((a) => a.key === keyOrNull) ?? null;
	}
	return all[Math.floor(Math.random() * all.length)] ?? null;
}

export function pickRandomArchetype(list: DesignArchetype[]): DesignArchetype {
	return list[Math.floor(Math.random() * list.length)]!;
}
