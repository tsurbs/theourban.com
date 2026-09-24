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

type GeminiCandidate = {
	content?: { parts?: Array<{ text?: string }> };
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
	const parts = candidate?.content?.parts;
	if (!parts?.length) {
		const blockReason = data.promptFeedback?.blockReason;
		throw new Error(blockReason ? `Gemini blocked: ${blockReason}` : 'Gemini returned no content');
	}

	return {
		text: parts.map((p) => p.text ?? '').join(''),
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

/**
 * Stream generateContent via SSE (`alt=sse`). Yields text chunks, then a final
 * `done` event with accumulated text, usage, and finishReason.
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

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(buildRequestBody({ systemInstruction, messages, generationConfig }))
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini API returned ${res.status}: ${errText}`);
	}

	if (!res.body) {
		throw new Error('Gemini stream returned no body');
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let accumulated = '';
	let usage: GeminiUsage | null = null;
	let finishReason: string | null = null;

	const processSseBlock = function* (block: string): Generator<GeminiStreamEvent> {
		const lines = block.split('\n');
		const dataLines: string[] = [];
		for (const line of lines) {
			if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trimStart());
			}
		}
		if (dataLines.length === 0) return;
		const payload = dataLines.join('\n').trim();
		if (!payload || payload === '[DONE]') return;

		let data: GeminiResponseBody;
		try {
			data = JSON.parse(payload) as GeminiResponseBody;
		} catch {
			return;
		}

		const candidate = data.candidates?.[0];
		if (candidate?.finishReason) {
			finishReason = candidate.finishReason;
		}
		const parsed = parseUsage(data.usageMetadata);
		if (parsed) usage = parsed;

		const parts = candidate?.content?.parts;
		if (parts?.length) {
			const piece = parts.map((p) => p.text ?? '').join('');
			if (piece) {
				accumulated += piece;
				yield { type: 'chunk', text: piece };
			}
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let sep: number;
		while ((sep = buffer.indexOf('\n\n')) !== -1) {
			const block = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			yield* processSseBlock(block);
		}
	}

	if (buffer.trim()) {
		yield* processSseBlock(buffer);
	}

	if (!accumulated) {
		throw new Error('Gemini stream returned no content');
	}

	yield { type: 'done', text: accumulated, usage, finishReason };
}
