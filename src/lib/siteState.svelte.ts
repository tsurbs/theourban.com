export const siteState = $state({
    generatedHtml: '',
    styleGuide: null as Record<string, any> | null,
    hasGenerated: false,
    feedbackHistory: [] as string[]
});
