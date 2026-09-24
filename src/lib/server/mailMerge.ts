import { escapeHtmlForMailMerge } from '$lib/previewSecurity';

// Keys whose string values are authored as HTML fragments in content.json and
// should be merged in as-is (not HTML-escaped) so paragraphs, lists, links,
// <i>/<sub>/<sup>, and named entities like &Sigma; render rather than appear
// as literal text. Extend this set if new HTML-bearing fields are added.
const HTML_VALUE_KEYS: ReadonlySet<string> = new Set(['content']);

export type MergeEntry = { value: string; isHtml: boolean };

export function createMailMerge(
	obj: Record<string, unknown>,
	prefix: string = 'CONTENT_VAR_'
): { template: Record<string, unknown>; mapping: Record<string, MergeEntry> } {
	const mapping: Record<string, MergeEntry> = {};
	let counter = 0;

	function walk(val: unknown, parentKey?: string): unknown {
		if (typeof val === 'string') {
			const isLikelyPath = val.startsWith('/') || val.startsWith('http');
			if (!isLikelyPath && val.length > 0) {
				const id = `${prefix}${counter++}`;
				mapping[id] = {
					value: val,
					isHtml: parentKey != null && HTML_VALUE_KEYS.has(parentKey)
				};
				return `[[${id}]]`;
			}
			return val;
		}
		if (Array.isArray(val)) {
			return val.map((item) => walk(item, parentKey));
		}
		if (val !== null && typeof val === 'object') {
			const newObj: Record<string, unknown> = {};
			const typedVal = val as Record<string, unknown>;
			for (const key in typedVal) {
				newObj[key] = walk(typedVal[key], key);
			}
			return newObj;
		}
		return val;
	}

	return { template: walk(obj) as Record<string, unknown>, mapping };
}

/**
 * Decide whether a given placeholder occurrence is in an HTML text-node
 * context (between tags) vs. an unsafe-for-raw-HTML context (inside an
 * attribute value, inside <script>/<style>/<title>, etc.).
 *
 * Heuristics, scanning the document up to `index`:
 *  - If we're inside <script>, <style>, or <title> (no closing tag yet for the
 *    most recent opener) → not text-node.
 *  - Else, find the last unquoted '<' or '>' before `index`. If '>' wins, we
 *    are between tags → text-node. If '<' wins, we are inside a tag (attrs).
 */
function isHtmlTextNodeContext(html: string, index: number): boolean {
	const upto = html.slice(0, index);
	const lowered = upto.toLowerCase();

	for (const tag of ['script', 'style', 'title']) {
		const openIdx = lowered.lastIndexOf(`<${tag}`);
		if (openIdx === -1) continue;
		const closeIdx = lowered.lastIndexOf(`</${tag}`);
		if (closeIdx < openIdx) return false;
	}

	const lastGt = upto.lastIndexOf('>');
	const lastLt = upto.lastIndexOf('<');
	if (lastLt === -1) return true;
	return lastGt > lastLt;
}

export function mergePlaceholders(html: string, mapping: Record<string, MergeEntry>): string {
	const placeholderRe = /\[\[(CONTENT_VAR_\d+)\]\]/g;
	return html.replace(placeholderRe, (match, id: string, offset: number) => {
		const entry = mapping[id];
		if (!entry) return match;
		if (entry.isHtml && isHtmlTextNodeContext(html, offset)) {
			return entry.value;
		}
		return escapeHtmlForMailMerge(entry.value);
	});
}

/** Collect placeholder ids that appear for HTML-bearing `content` fields. */
export function contentPlaceholderIds(mapping: Record<string, MergeEntry>): string[] {
	return Object.entries(mapping)
		.filter(([, entry]) => entry.isHtml)
		.map(([id]) => id);
}

/** Find the placeholder id whose value equals the given string (exact match). */
export function placeholderIdForValue(
	mapping: Record<string, MergeEntry>,
	value: string
): string | null {
	for (const [id, entry] of Object.entries(mapping)) {
		if (entry.value === value) return id;
	}
	return null;
}
