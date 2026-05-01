const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiChatTurn = { role: 'user' | 'model'; content: string };

export async function geminiGenerateContent(options: {
	apiKey: string;
	model: string;
	systemInstruction: string;
	messages: GeminiChatTurn[];
}): Promise<string> {
	const { apiKey, model, systemInstruction, messages } = options;

	const contents = messages.map((m) => ({
		role: m.role === 'model' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: systemInstruction }] },
			contents
		})
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini API returned ${res.status}: ${errText}`);
	}

	const data = (await res.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		promptFeedback?: { blockReason?: string };
	};

	const parts = data.candidates?.[0]?.content?.parts;
	if (!parts?.length) {
		const blockReason = data.promptFeedback?.blockReason;
		throw new Error(blockReason ? `Gemini blocked: ${blockReason}` : 'Gemini returned no content');
	}

	return parts.map((p) => p.text ?? '').join('');
}
