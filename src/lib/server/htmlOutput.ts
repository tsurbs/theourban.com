import type { MergeEntry } from '$lib/server/mailMerge';
import { contentPlaceholderIds, placeholderIdForValue } from '$lib/server/mailMerge';
import { extractHtmlDocument } from '$lib/htmlPreview';

export { extractHtmlDocument };

export type HtmlValidationIssue = string;

export function validateGeneratedHtml(options: {
	html: string;
	finishReason: string | null;
	mapping: Record<string, MergeEntry>;
	name: string;
	headline: string;
}): HtmlValidationIssue[] {
	const { html, finishReason, mapping, name, headline } = options;
	const issues: HtmlValidationIssue[] = [];

	const reason = (finishReason ?? '').toUpperCase();
	if (reason && reason !== 'STOP' && reason !== 'FINISH_REASON_UNSPECIFIED') {
		issues.push(`Model stopped early (finishReason=${finishReason})`);
	}

	if (!/<\/html\s*>/i.test(html)) {
		issues.push('Missing closing </html>');
	}

	const contentIds = contentPlaceholderIds(mapping);
	for (const id of contentIds) {
		if (!html.includes(`[[${id}]]`)) {
			issues.push(`Missing content placeholder [[${id}]]`);
		}
	}

	const nameId = placeholderIdForValue(mapping, name);
	if (nameId && !html.includes(`[[${nameId}]]`)) {
		issues.push(`Missing name placeholder [[${nameId}]]`);
	}

	const headlineId = placeholderIdForValue(mapping, headline);
	if (headlineId && !html.includes(`[[${headlineId}]]`)) {
		issues.push(`Missing headline placeholder [[${headlineId}]]`);
	}

	return issues;
}

/** After mail-merge, leftover placeholders indicate a failure. */
export function findLeftoverPlaceholders(mergedHtml: string): string[] {
	const found = mergedHtml.match(/\[\[CONTENT_VAR_\d+\]\]/g);
	return found ? [...new Set(found)] : [];
}
