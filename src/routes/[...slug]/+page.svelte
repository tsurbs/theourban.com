<script lang="ts">
	import { onMount } from "svelte";
	import { siteState } from "$lib/siteState.svelte";

	let loading = $state(!siteState.hasGenerated);
	let error = $state("");

	onMount(() => {
		// Only run the generation flow if we haven't already generated the site in this session.
		// Hard refreshes will reset siteState.hasGenerated to false, triggering a new build.
		// Internal SvelteKit client-side navigation will keep siteState, so this won't run again.
		if (siteState.hasGenerated) {
			loading = false;
			return;
		}

		const abortController = new AbortController();

		async function init() {
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

				// 2. Generate the ENTIRE SPA
				const uiRes = await fetch("/api/generate-ui", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ styleGuide: siteState.styleGuide }),
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

		init();

		return () => {
			abortController.abort();
		};
	});
</script>

<svelte:head>
	<title>Theo Urban</title>
</svelte:head>

<div class="fullscreen-container">
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
			</div>
		</div>
	{:else}
		<iframe srcdoc={siteState.generatedHtml} title="Portfolio Site"
		></iframe>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: white;
	}

	.fullscreen-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: white;
		z-index: 9999;
	}

	.loader-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: white;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(0, 0, 0, 0.05);
		border-top: 3px solid #333;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f9f9f9;
		padding: 20px;
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
