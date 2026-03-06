<script lang="ts">
	import { onMount } from "svelte";
	import { siteState } from "$lib/siteState.svelte";
	import "../app.css";

	let { children } = $props();

	let loading = $state(!siteState.hasGenerated);
	let error = $state("");
	let feedbackInput = $state("");

	async function runGeneration() {
		const abortController = new AbortController();
		try {
			loading = true;
			error = "";

			// 1. Generate Style Guide if missing
			if (!siteState.styleGuide) {
				const styleRes = await fetch("/api/generate-style-guide", {
					method: "POST",
					signal: abortController.signal,
				});
				if (!styleRes.ok) {
					const errData = await styleRes.json().catch(() => ({}));
					throw new Error(
						errData.error ||
							`Style API returned ${styleRes.status}`,
					);
				}
				const styleData = await styleRes.json();
				siteState.styleGuide = styleData.styleGuide;
			}

			// 2. Generate the ENTIRE SPA with feedback history and current state
			const uiRes = await fetch("/api/generate-ui", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					styleGuide: siteState.styleGuide,
					feedbackHistory: siteState.feedbackHistory,
					oldHtml: siteState.generatedHtml,
				}),
				signal: abortController.signal,
			});

			if (!uiRes.ok) {
				const errData = await uiRes.json().catch(() => ({}));
				throw new Error(
					errData.error || `UI API returned ${uiRes.status}`,
				);
			}

			const uiData = await uiRes.json();
			if (uiData.error) throw new Error(uiData.error);

			siteState.generatedHtml = uiData.html;
			siteState.hasGenerated = true;
			loading = false;
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
			console.error("Error in generation flow:", err);
			error = (err as Error).message || "Failed to generate UI";
			loading = false;
		}
	}

	function handleRegenerate() {
		if (!feedbackInput.trim()) return;
		siteState.feedbackHistory.push(feedbackInput.trim());
		feedbackInput = "";
		runGeneration();
	}

	onMount(() => {
		if (!siteState.hasGenerated) {
			runGeneration();
		} else {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Theo Urban</title>
</svelte:head>

<div class="site-takeover">
	{#if loading}
		<div class="loader-overlay">
			<div class="spinner"></div>
		</div>
	{:else if error}
		<div class="error-overlay">
			<div class="error-card">
				<h2>Error Generating UI</h2>
				<p>{error}</p>
				{#if error.includes("OPENROUTER_API_KEY")}
					<div class="env-hint">OPENROUTER_API_KEY=your_key_here</div>
					<p class="small">
						Add this to your <code>.env</code> file.
					</p>
				{/if}
				<button class="retry-btn" onclick={() => runGeneration()}
					>Retry</button
				>
			</div>
		</div>
	{:else}
		<!-- Input Overlay -->
		<div class="feedback-overlay">
			<div class="input-container">
				<input
					type="text"
					bind:value={feedbackInput}
					placeholder="Describe changes or feedback..."
					onkeydown={(e) => e.key === "Enter" && handleRegenerate()}
				/>
				<button
					onclick={handleRegenerate}
					disabled={!feedbackInput.trim()}
				>
					Regenerate
				</button>
			</div>
		</div>

		<iframe srcdoc={siteState.generatedHtml} title="Portfolio Site"
		></iframe>
	{/if}
</div>

<!-- Render children just in case, though they will be hidden under the takeover -->
<div style="display: none;">
	{@render children?.()}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: white;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
			Helvetica, Arial, sans-serif;
	}

	.site-takeover {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: white;
		z-index: 10000;
	}

	.loader-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
		z-index: 100;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(0, 0, 0, 0.05);
		border-top: 3px solid #333;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.feedback-overlay {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10000;
		width: 90%;
		max-width: 600px;
	}

	.input-container {
		display: flex;
		gap: 10px;
		padding: 8px;
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 999px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
	}

	.input-container input {
		flex: 1;
		border: none;
		background: transparent;
		padding: 8px 16px;
		outline: none;
		font-size: 14px;
		color: #1a1a1a;
	}

	.input-container button {
		padding: 8px 20px;
		background: #1a1a1a;
		color: white;
		border: none;
		border-radius: 999px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.input-container button:hover:not(:disabled) {
		background: #333;
		transform: translateY(-1px);
	}

	.input-container button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f9f9f9;
		padding: 20px;
		z-index: 101;
	}

	.error-card {
		max-width: 400px;
		padding: 30px;
		background: #fffafa;
		border: 1px solid #ffcccc;
		border-radius: 12px;
		text-align: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.error-card h2 {
		color: #cc0000;
		margin-top: 0;
	}

	.retry-btn {
		margin-top: 20px;
		padding: 8px 24px;
		background: #cc0000;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}

	.env-hint {
		margin-top: 20px;
		padding: 10px;
		background: #eee;
		font-family: monospace;
		font-size: 0.9em;
		border-radius: 4px;
	}

	.small {
		font-size: 0.85em;
		color: #666;
		margin-top: 10px;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
