/** Marker on injected CSP meta so we do not duplicate when re-processing HTML. */
export const PREVIEW_SECURITY_MARKER = 'data-theourban-preview';

const PREVIEW_CSP = [
	"default-src 'none'",
	"base-uri 'none'",
	"object-src 'none'",
	"style-src 'unsafe-inline'",
	"img-src https: http: data: blob:",
	"font-src https: http: data:",
	"media-src https: http: data: blob:",
	"connect-src https: http: ws: wss:",
	"script-src 'unsafe-inline'",
	"form-action https: http:",
].join('; ');

function escapeHtmlAttribute(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;');
}

/** Escape merged JSON strings when substituted into model HTML (text / attribute safe). */
export function escapeHtmlForMailMerge(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Insert a strict CSP meta tag into preview HTML if not already present.
 * Stored generations and older DB rows both go through this before iframe srcdoc.
 */
export function ensurePreviewContentSecurityPolicy(html: string): string {
	if (!html || html.includes(PREVIEW_SECURITY_MARKER)) return html;

	const meta = `<meta http-equiv="Content-Security-Policy" ${PREVIEW_SECURITY_MARKER}="" content="${escapeHtmlAttribute(PREVIEW_CSP)}">\n`;

	const headRe = /<head(\s[^>]*)?>/i;
	const headMatch = headRe.exec(html);
	if (headMatch) {
		const insertAt = headMatch.index + headMatch[0].length;
		return html.slice(0, insertAt) + meta + html.slice(insertAt);
	}

	const htmlRe = /<html(\s[^>]*)?>/i;
	const htmlMatch = htmlRe.exec(html);
	if (htmlMatch) {
		const insertAt = htmlMatch.index + htmlMatch[0].length;
		return html.slice(0, insertAt) + `<head>${meta}</head>` + html.slice(insertAt);
	}

	return `<head>${meta}</head>${html}`;
}
