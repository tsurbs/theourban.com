import type { GenerationCallStats } from '$lib/generationStats';

export const siteState = $state({
	generatedHtml: '',
	styleGuide: null as Record<string, unknown> | null,
	hasGenerated: false,
	feedbackHistory: [] as string[],
	generationStats: {
		ui: null as GenerationCallStats | null,
		styleGuide: null as GenerationCallStats | null
	}
});
