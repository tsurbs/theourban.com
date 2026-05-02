import type { GenerationCallStats } from '$lib/generationStats';

const LS_TOTALS = 'theourban_lifetime_nerd';
const LS_LOG = 'theourban_prompt_nerd_log';
const LOG_CAP = 80;

export type NerdPromptKind = 'style-guide' | 'ui';

export type NerdPromptLogEntry = {
	id: string;
	at: string;
	kind: NerdPromptKind;
	summary: string;
	stats: GenerationCallStats;
	slug?: string;
};

export type LifetimeNerdTotals = {
	totalTokens: number;
	totalCostUsd: number;
	callCount: number;
	lastUpdated: string;
};

function uid() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyLifetimeTotals(): LifetimeNerdTotals {
	return { totalTokens: 0, totalCostUsd: 0, callCount: 0, lastUpdated: '' };
}

export function loadLifetimeTotals(): LifetimeNerdTotals {
	if (typeof localStorage === 'undefined') return emptyLifetimeTotals();
	try {
		const raw = localStorage.getItem(LS_TOTALS);
		if (!raw) return emptyLifetimeTotals();
		const p = JSON.parse(raw) as Partial<LifetimeNerdTotals>;
		return {
			totalTokens: typeof p.totalTokens === 'number' ? p.totalTokens : 0,
			totalCostUsd: typeof p.totalCostUsd === 'number' ? p.totalCostUsd : 0,
			callCount: typeof p.callCount === 'number' ? p.callCount : 0,
			lastUpdated: typeof p.lastUpdated === 'string' ? p.lastUpdated : ''
		};
	} catch {
		return emptyLifetimeTotals();
	}
}

export function loadPromptLog(): NerdPromptLogEntry[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(LS_LOG);
		if (!raw) return [];
		const arr = JSON.parse(raw) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr.filter(
			(x): x is NerdPromptLogEntry =>
				x &&
				typeof x === 'object' &&
				typeof (x as NerdPromptLogEntry).id === 'string' &&
				typeof (x as NerdPromptLogEntry).at === 'string' &&
				typeof (x as NerdPromptLogEntry).summary === 'string' &&
				typeof (x as NerdPromptLogEntry).kind === 'string' &&
				(x as NerdPromptLogEntry).stats &&
				typeof (x as NerdPromptLogEntry).stats === 'object'
		);
	} catch {
		return [];
	}
}

function saveLifetimeTotals(t: LifetimeNerdTotals) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(LS_TOTALS, JSON.stringify(t));
}

function savePromptLog(log: NerdPromptLogEntry[]) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(LS_LOG, JSON.stringify(log.slice(0, LOG_CAP)));
}

/** Append one generation to the log and lifetime counters (newest first). */
export function appendNerdPrompt(
	partial: Omit<NerdPromptLogEntry, 'id' | 'at'>
): { lifetime: LifetimeNerdTotals; log: NerdPromptLogEntry[] } {
	const entry: NerdPromptLogEntry = {
		...partial,
		id: uid(),
		at: new Date().toISOString()
	};

	const prev = loadLifetimeTotals();
	const lifetime: LifetimeNerdTotals = {
		totalTokens: prev.totalTokens + partial.stats.totalTokenCount,
		totalCostUsd: prev.totalCostUsd + partial.stats.estimatedCostUsd,
		callCount: prev.callCount + 1,
		lastUpdated: entry.at
	};
	saveLifetimeTotals(lifetime);

	const log = [entry, ...loadPromptLog()].slice(0, LOG_CAP);
	savePromptLog(log);

	return { lifetime, log };
}

export function clearNerdLedger() {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(LS_TOTALS);
	localStorage.removeItem(LS_LOG);
}
