const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiChatTurn = { role: 'user' | 'model'; content: string };

export type GeminiUsage = {
	promptTokenCount: number;
	candidatesTokenCount: number;
	totalTokenCount: number;
	cachedContentTokenCount?: number;
	thoughtsTokenCount?: number;
};

export type GeminiGenerationConfig = {
	temperature?: number;
	maxOutputTokens?: number;
	responseMimeType?: string;
	responseSchema?: Record<string, unknown>;
	topP?: number;
	topK?: number;
};

type GeminiUsageMetadata = {
	promptTokenCount?: number;
	candidatesTokenCount?: number;
	totalTokenCount?: number;
	cachedContentTokenCount?: number;
	thoughtsTokenCount?: number;
};

type GeminiPart = {
	text?: string;
	thought?: boolean;
	thoughtSignature?: string;
};

type GeminiCandidate = {
	content?: { parts?: GeminiPart[] };
	finishReason?: string;
};

type GeminiResponseBody = {
	candidates?: GeminiCandidate[];
	promptFeedback?: { blockReason?: string };
	usageMetadata?: GeminiUsageMetadata;
};

function parseUsage(u: GeminiUsageMetadata | undefined): GeminiUsage | null {
	if (!u || typeof u.totalTokenCount !== 'number') return null;
	return {
		promptTokenCount: u.promptTokenCount ?? 0,
		candidatesTokenCount: u.candidatesTokenCount ?? 0,
		totalTokenCount: u.totalTokenCount,
		...(typeof u.cachedContentTokenCount === 'number'
			? { cachedContentTokenCount: u.cachedContentTokenCount }
			: {}),
		...(typeof u.thoughtsTokenCount === 'number'
			? { thoughtsTokenCount: u.thoughtsTokenCount }
			: {})
	};
}

function buildRequestBody(options: {
	systemInstruction: string;
	messages: GeminiChatTurn[];
	generationConfig?: GeminiGenerationConfig;
}) {
	const contents = options.messages.map((m) => ({
		role: m.role === 'model' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	return {
		systemInstruction: { parts: [{ text: options.systemInstruction }] },
		contents,
		...(options.generationConfig
			? { generationConfig: options.generationConfig }
			: {})
	};
}

/** Extract visible answer text from parts (skip thought summaries / signature-only). */
function extractAnswerText(parts: GeminiPart[] | undefined): string {
	if (!parts?.length) return '';
	return parts
		.filter((p) => typeof p.text === 'string' && p.text.length > 0 && !p.thought)
		.map((p) => p.text as string)
		.join('');
}

/** Extract any text including thought summaries (used for non-stream fallback parity). */
function extractAllText(parts: GeminiPart[] | undefined): string {
	if (!parts?.length) return '';
	return parts
		.filter((p) => typeof p.text === 'string' && p.text.length > 0)
		.map((p) => p.text as string)
		.join('');
}

function emptyContentError(
	data: GeminiResponseBody | null,
	finishReason: string | null
): Error {
	const blockReason = data?.promptFeedback?.blockReason;
	if (blockReason) {
		return new Error(`Gemini blocked: ${blockReason}`);
	}
	const reason = (finishReason ?? '').toUpperCase();
	if (reason === 'SAFETY' || reason === 'BLOCKLIST' || reason === 'PROHIBITED_CONTENT') {
		return new Error(`Gemini blocked: ${finishReason}`);
	}
	if (reason === 'RECITATION') {
		return new Error(`Gemini stopped (finishReason=${finishReason})`);
	}
	if (finishReason) {
		return new Error(`Gemini returned no content (finishReason=${finishReason})`);
	}
	return new Error('Gemini returned no content');
}

export async function geminiGenerateContent(options: {
	apiKey: string;
	model: string;
	systemInstruction: string;
	messages: GeminiChatTurn[];
	generationConfig?: GeminiGenerationConfig;
}): Promise<{ text: string; usage: GeminiUsage | null; finishReason: string | null }> {
	const { apiKey, model, systemInstruction, messages, generationConfig } = options;

	const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(buildRequestBody({ systemInstruction, messages, generationConfig }))
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini API returned ${res.status}: ${errText}`);
	}

	const data = (await res.json()) as GeminiResponseBody;

	const candidate = data.candidates?.[0];
	const text = extractAnswerText(candidate?.content?.parts) || extractAllText(candidate?.content?.parts);
	if (!text) {
		throw emptyContentError(data, candidate?.finishReason ?? null);
	}

	return {
		text,
		usage: parseUsage(data.usageMetadata),
		finishReason: candidate?.finishReason ?? null
	};
}

export type GeminiStreamEvent =
	| { type: 'chunk'; text: string }
	| {
			type: 'done';
			text: string;
			usage: GeminiUsage | null;
			finishReason: string | null;
	  };

type StreamAccum = {
	text: string;
	usage: GeminiUsage | null;
	finishReason: string | null;
	blockReason: string | null;
};

function applyResponseChunk(accum: StreamAccum, data: GeminiResponseBody): string {
	if (data.promptFeedback?.blockReason) {
		accum.blockReason = data.promptFeedback.blockReason;
	}

	const candidate = data.candidates?.[0];
	if (candidate?.finishReason) {
		accum.finishReason = candidate.finishReason;
	}
	const parsed = parseUsage(data.usageMetadata);
	if (parsed) accum.usage = parsed;

	const piece =
		extractAnswerText(candidate?.content?.parts) ||
		// Some thinking-only chunks only have thought text; ignore those for HTML.
		// If the stream never yields answer text, fallback generateContent handles it.
		'';
	if (piece) {
		accum.text += piece;
	}
	return piece;
}

function parseJsonPayload(payload: string): GeminiResponseBody | GeminiResponseBody[] | null {
	const trimmed = payload.trim();
	if (!trimmed || trimmed === '[DONE]') return null;
	try {
		return JSON.parse(trimmed) as GeminiResponseBody | GeminiResponseBody[];
	} catch {
		return null;
	}
}

function* emitFromParsed(
	accum: StreamAccum,
	parsed: GeminiResponseBody | GeminiResponseBody[]
): Generator<GeminiStreamEvent> {
	const items = Array.isArray(parsed) ? parsed : [parsed];
	for (const data of items) {
		if (!data || typeof data !== 'object') continue;
		const piece = applyResponseChunk(accum, data);
		if (piece) yield { type: 'chunk', text: piece };
	}
}

/** Parse one SSE event block (already split on blank line). */
function* processSseBlock(accum: StreamAccum, block: string): Generator<GeminiStreamEvent> {
	const lines = block.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const dataLines: string[] = [];
	for (const line of lines) {
		if (line.startsWith('data:')) {
			dataLines.push(line.slice(5).trimStart());
		}
	}
	if (dataLines.length === 0) return;
	const parsed = parseJsonPayload(dataLines.join('\n'));
	if (!parsed) return;
	yield* emitFromParsed(accum, parsed);
}

/**
 * Consume a non-SSE body: JSON array (`[{...},{...}]`) or NDJSON lines.
 * Used when alt=sse is ignored or proxies rewrite the stream.
 */
function* processRawBody(accum: StreamAccum, raw: string): Generator<GeminiStreamEvent> {
	const normalized = raw.replace(/^\uFEFF/, '').trim();
	if (!normalized) return;

	const asJson = parseJsonPayload(normalized);
	if (asJson) {
		yield* emitFromParsed(accum, asJson);
		return;
	}

	// NDJSON / concatenated objects: try line-by-line
	for (const line of normalized.replace(/\r\n/g, '\n').split('\n')) {
		const parsed = parseJsonPayload(line);
		if (parsed) yield* emitFromParsed(accum, parsed);
	}
}

function throwIfEmptyStream(accum: StreamAccum): void {
	if (accum.text) return;
	if (accum.blockReason) {
		throw new Error(`Gemini blocked: ${accum.blockReason}`);
	}
	throw emptyContentError(null, accum.finishReason);
}

/**
 * Stream generateContent via SSE (`alt=sse`). Yields text chunks, then a final
 * `done` event with accumulated text, usage, and finishReason.
 *
 * Falls back to non-streaming `generateContent` when the stream ends empty
 * (or when the response body is not SSE), so callers still get a result.
 */
export async function* geminiStreamGenerateContent(options: {
	apiKey: string;
	model: string;
	systemInstruction: string;
	messages: GeminiChatTurn[];
	generationConfig?: GeminiGenerationConfig;
}): AsyncGenerator<GeminiStreamEvent> {
	const { apiKey, model, systemInstruction, messages, generationConfig } = options;

	const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
			body: JSON.stringify(buildRequestBody({ systemInstruction, messages, generationConfig }))
		});
	} catch (err) {
		// Network / fetch failure → non-stream fallback
		const fallback = await geminiGenerateContent(options);
		if (fallback.text) yield { type: 'chunk', text: fallback.text };
		yield {
			type: 'done',
			text: fallback.text,
			usage: fallback.usage,
			finishReason: fallback.finishReason
		};
		return;
	}

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini API returned ${res.status}: ${errText}`);
	}

	if (!res.body) {
		const fallback = await geminiGenerateContent(options);
		if (fallback.text) yield { type: 'chunk', text: fallback.text };
		yield {
			type: 'done',
			text: fallback.text,
			usage: fallback.usage,
			finishReason: fallback.finishReason
		};
		return;
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const accum: StreamAccum = {
		text: '',
		usage: null,
		finishReason: null,
		blockReason: null
	};
	let sawSseData = false;
	const contentType = (res.headers.get('content-type') || '').toLowerCase();
	const likelyJsonArray =
		contentType.includes('application/json') && !contentType.includes('text/event-stream');

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			// Normalize CRLF early so `\n\n` frame splits work with HTTP-style SSE.
			buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

			if (!likelyJsonArray) {
				let sep: number;
				while ((sep = buffer.indexOf('\n\n')) !== -1) {
					const block = buffer.slice(0, sep);
					buffer = buffer.slice(sep + 2);
					if (block.includes('data:')) sawSseData = true;
					yield* processSseBlock(accum, block);
				}
			}
		}
		buffer += decoder.decode();

		if (likelyJsonArray || (!sawSseData && buffer.trim())) {
			// Entire body was JSON array / NDJSON, or leftover after failed SSE framing.
			yield* processRawBody(accum, buffer);
		} else if (buffer.trim()) {
			yield* processSseBlock(accum, buffer);
		}
	} finally {
		reader.releaseLock();
	}

	if (!accum.text) {
		// Stream parsed but produced no answer text — common with thinking-only
		// finish chunks, safety blocks, or mangled SSE. Fall back to unary call.
		try {
			const fallback = await geminiGenerateContent(options);
			if (fallback.text) {
				accum.text = fallback.text;
				accum.usage = fallback.usage ?? accum.usage;
				accum.finishReason = fallback.finishReason ?? accum.finishReason;
				yield { type: 'chunk', text: fallback.text };
			}
		} catch (fallbackErr) {
			// Prefer the more specific stream-side error if fallback also empty/blocked.
			if (accum.blockReason || accum.finishReason) {
				throwIfEmptyStream(accum);
			}
			throw fallbackErr;
		}
	}

	throwIfEmptyStream(accum);
	yield {
		type: 'done',
		text: accum.text,
		usage: accum.usage,
		finishReason: accum.finishReason
	};
}
