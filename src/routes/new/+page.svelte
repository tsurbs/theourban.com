<script lang="ts">
	import { goto } from "$app/navigation";
	import { getDefaultSiteSlug } from "$lib/defaultSiteSlug";
	import { siteState } from "$lib/siteState.svelte";

	const defaultSlug = getDefaultSiteSlug();

	let loading = $state(false);
	let error = $state("");

	async function rollNewSite() {
		error = "";
		loading = true;
		try {
			siteState.generatedHtml = "";
			siteState.styleGuide = null;
			siteState.hasGenerated = false;
			siteState.feedbackHistory = [];
			siteState.generationStats = { ui: null, styleGuide: null };

			const styleRes = await fetch("/api/generate-style-guide", { method: "POST" });

			if (!styleRes.ok) {
				const errData = await styleRes.json().catch(() => ({}));
				throw new Error(errData.error || `Style API returned ${styleRes.status}`);
			}

			const styleData = await styleRes.json();
			siteState.styleGuide = styleData.styleGuide;
			if (styleData.stats) siteState.generationStats.styleGuide = styleData.stats;

			await goto(`/${styleData.slug}`);
		} catch (err) {
			console.error(err);
			error = (err as Error).message || "Failed to start generation";
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>New theme · Theo Urban</title>
</svelte:head>

<div class="wrap">
	<p class="kicker">Generative portfolio</p>
	<h1>Roll a random theme</h1>
	<p class="hint">
		The site root <strong>/</strong> redirects to <strong>/{defaultSlug}</strong> (configurable). This page starts a
		fresh style + layout at a new URL slug via the APIs.
	</p>

	<button type="button" class="btn" onclick={() => rollNewSite()} disabled={loading}>
		{#if loading}
			Starting…
		{:else}
			New random site
		{/if}
	</button>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<p class="back">
		<a href={`/${defaultSlug}`}>Home preview</a>
		· <a href="/gallery">Gallery</a>
	</p>
</div>

<style>
	.wrap {
		max-width: 28rem;
		margin: 0 auto;
		padding: 2rem 1.25rem;
		font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
		line-height: 1.5;
		color: #1a1a1a;
	}

	.kicker {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #64748b;
		margin: 0 0 0.55rem;
	}

	h1 {
		font-size: 1.45rem;
		margin: 0 0 0.75rem;
		font-weight: 650;
	}

	.hint {
		margin: 0 0 1.35rem;
		font-size: 0.95rem;
		color: #475569;
	}

	.btn {
		padding: 0.55rem 1.15rem;
		border-radius: 999px;
		border: none;
		font-weight: 600;
		font-size: 0.9rem;
		background: #111;
		color: #fff;
		cursor: pointer;
		font-family: inherit;
	}

	.btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.btn:not(:disabled):hover {
		background: #333;
	}

	.error {
		margin: 1rem 0 0;
		font-size: 0.88rem;
		color: #b91c1c;
	}

	.back {
		margin: 2rem 0 0;
		font-size: 0.88rem;
		color: #64748b;
	}

	a {
		color: #0b57d0;
		text-decoration-color: transparent;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
