export type GenerationCallStats = {
	promptTokenCount: number;
	candidatesTokenCount: number;
	totalTokenCount: number;
	durationMs: number;
	estimatedCostUsd: number;
	pricingNote: string;
	/** Gemini model id used for the call */
	model?: string;
	/** Present when context caching was used */
	cachedContentTokenCount?: number;
	/** Present on some models (e.g. thinking) */
	thoughtsTokenCount?: number;
};
