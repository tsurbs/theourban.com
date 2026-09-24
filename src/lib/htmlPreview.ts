/**
 * Client-safe helpers for streaming / partial HTML preview in the iframe.
 */

export function extractHtmlDocument(raw: string): string {
	let text = raw.trim();

	if (text.startsWith('```html')) {
		text = text.replace(/^```html\n?/, '').replace(/\n?```\s*$/, '');
	} else if (text.startsWith('```')) {
		text = text.replace(/^```\n?/, '').replace(/\n?```\s*$/, '');
	}

	text = text.trim();

	const lower = text.toLowerCase();
	const doctypeIdx = lower.indexOf('<!doctype');
	const htmlOpenIdx = lower.indexOf('<html');
	let start = -1;
	if (doctypeIdx !== -1 && htmlOpenIdx !== -1) {
		start = Math.min(doctypeIdx, htmlOpenIdx);
	} else if (doctypeIdx !== -1) {
		start = doctypeIdx;
	} else if (htmlOpenIdx !== -1) {
		start = htmlOpenIdx;
	}

	if (start === -1) return text;

	const closeIdx = lower.lastIndexOf('</html>');
	if (closeIdx === -1) return text.slice(start);

	return text.slice(start, closeIdx + '</html>'.length);
}

/** Neutral client-side preview of partial HTML during streaming. */
export function previewPartialHtml(raw: string): string {
	let html = extractHtmlDocument(raw);
	html = html.replace(/\[\[CONTENT_VAR_\d+\]\]/g, '…');
	html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
	html = html.replace(/<script\b[^>]*\/>/gi, '');
	if (!/<\/html\s*>/i.test(html) && /<html\b/i.test(html)) {
		if (!/<\/body\s*>/i.test(html)) {
			html += '</body>';
		}
		html += '</html>';
	}
	return html;
}
