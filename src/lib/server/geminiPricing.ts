import type { GenerationCallStats } from '$lib/generationStats';
import type { GeminiUsage } from '$lib/server/gemini';

/** Gemini 3.1 Flash-Lite Standard tier, paid, text (ai.google.dev/pricing) */
const INPUT_PER_M_USD = 0.25;
const OUTPUT_PER_M_USD = 1.5;

const PRICING_NOTE =
	'Estimated at Gemini 3.1 Flash-Lite Standard (paid) text rates: $0.25/M input, $1.50/M output.';

export function estimateGemini31FlashLiteStandardUsd(usage: GeminiUsage): number {
	return (
		(usage.promptTokenCount / 1_000_000) * INPUT_PER_M_USD +
		(usage.candidatesTokenCount / 1_000_000) * OUTPUT_PER_M_USD
	);
}

export function buildGenerationCallStats(
	usage: GeminiUsage | null,
	durationMs: number
): GenerationCallStats | null {
	if (!usage) return null;
	return {
		promptTokenCount: usage.promptTokenCount,
		candidatesTokenCount: usage.candidatesTokenCount,
		totalTokenCount: usage.totalTokenCount,
		durationMs,
		estimatedCostUsd: estimateGemini31FlashLiteStandardUsd(usage),
		pricingNote: PRICING_NOTE
	};
}
