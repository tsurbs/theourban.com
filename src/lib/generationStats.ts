export type GenerationCallStats = {
	promptTokenCount: number;
	candidatesTokenCount: number;
	totalTokenCount: number;
	durationMs: number;
	estimatedCostUsd: number;
	pricingNote: string;
};
