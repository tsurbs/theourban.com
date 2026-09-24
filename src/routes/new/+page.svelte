<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { getDefaultSiteSlug } from "$lib/defaultSiteSlug";
	import { siteState } from "$lib/siteState.svelte";
	import { onMount } from "svelte";

	const defaultSlug = getDefaultSiteSlug();

	let loading = $state(false);
	let error = $state("");
	let themeInput = $state("");
	let layoutArchetype = $state("any");
	let archetypes = $state<Array<{ key: string; label: string }>>([]);

	const exampleChips = [
		"neon cosmic waves",
		"soft ceramic ateliers",
		"brutalist ink posters",
		"retro pixel machines",
	];

	onMount(() => {
		const q = page.url.searchParams.get("theme");
		if (q) themeInput = q.slice(0, 60);
		const layout = page.url.searchParams.get("layout");
		if (layout) layoutArchetype = layout;

		void (async () => {
			try {
				const r = await fetch("/api/archetypes");
				if (r.ok) {
					const data = (await r.json()) as {
						archetypes: Array<{ key: string; label: string }>;
					};
					archetypes = data.archetypes ?? [];
				}
			} catch (e) {
				console.error("Failed to load archetypes", e);
			}
		})();
	});

	async function startGeneration(opts: {
		themeWords?: string;
		surprise?: boolean;
	}) {
		error = "";
		loading = true;
		try {
			siteState.generatedHtml = "";
			siteState.styleGuide = null;
			siteState.hasGenerated = false;
			siteState.feedbackHistory = [];
			siteState.generationStats = { ui: null, styleGuide: null };

			const body: Record<string, string> = {};
			if (!opts.surprise && opts.themeWords?.trim()) {
				body.themeWords = opts.themeWords.trim();
			}
			if (layoutArchetype && layoutArchetype !== "any") {
				body.layoutArchetype = layoutArchetype;
			}

			const styleRes = await fetch("/api/generate-style-guide", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!styleRes.ok) {
				const errData = await styleRes.json().catch(() => ({}));
				throw new Error(
					errData.error || `Style API returned ${styleRes.status}`,
				);
			}

			const styleData = await styleRes.json();
			siteState.styleGuide = styleData.styleGuide;
			if (styleData.stats)
				siteState.generationStats.styleGuide = styleData.stats;

			await goto(resolve(`/${styleData.slug}`));
		} catch (err) {
			console.error(err);
			error = (err as Error).message || "Failed to start generation";
			loading = false;
		}
	}

	function onGenerate() {
		void startGeneration({ themeWords: themeInput });
	}

	function onSurprise() {
		themeInput = "";
		void startGeneration({ surprise: true });
	}

	function applyChip(chip: string) {
		themeInput = chip;
	}
</script>

<svelte:head>
	<title>New theme · Theo Urban</title>
</svelte:head>

<div class="wrap">
	<p class="kicker">Generative portfolio</p>
	<h1>Create a theme</h1>
	<p class="hint">
		Pick theme words and an optional layout, or surprise yourself. The site root
		<strong>/</strong> redirects to <strong>/{defaultSlug}</strong>.
	</p>

	<label class="field">
		<span class="label">Theme words</span>
		<input
			type="text"
			bind:value={themeInput}
			placeholder="e.g. soft ceramic ateliers"
			maxlength={60}
			disabled={loading}
			onkeydown={(e) => e.key === "Enter" && onGenerate()}
		/>
	</label>

	<div class="chips">
		{#each exampleChips as chip (chip)}
			<button
				type="button"
				class="chip"
				disabled={loading}
				onclick={() => applyChip(chip)}
			>
				{chip}
			</button>
		{/each}
	</div>

	<label class="field">
		<span class="label">Layout</span>
		<select bind:value={layoutArchetype} disabled={loading}>
			<option value="any">Any (random)</option>
			{#each archetypes as a (a.key)}
				<option value={a.key}>{a.label}</option>
			{/each}
		</select>
	</label>

	<div class="actions">
		<button
			type="button"
			class="btn"
			onclick={onGenerate}
			disabled={loading}
		>
			{#if loading}
				Starting…
			{:else}
				Generate
			{/if}
		</button>
		<button
			type="button"
			class="btn secondary"
			onclick={onSurprise}
			disabled={loading}
		>
			Surprise me
		</button>
	</div>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<p class="back">
		<a href={resolve(`/${defaultSlug}`)}>Home preview</a>
		· <a href={resolve("/gallery")}>Gallery</a>
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

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-bottom: 0.85rem;
	}

	.label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #64748b;
	}

	input,
	select {
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.14);
		font-size: 0.95rem;
		font-family: inherit;
		background: #fff;
		color: #1a1a1a;
	}

	input:focus,
	select:focus {
		outline: 2px solid rgba(11, 87, 208, 0.35);
		outline-offset: 1px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0 0 1rem;
	}

	.chip {
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #f8fafc;
		font-size: 0.78rem;
		color: #334155;
		cursor: pointer;
		font-family: inherit;
	}

	.chip:hover:not(:disabled) {
		background: #eef2ff;
		border-color: rgba(11, 87, 208, 0.25);
	}

	.chip:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.35rem;
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

	.btn.secondary {
		background: #fff;
		color: #111;
		border: 1px solid rgba(0, 0, 0, 0.14);
	}

	.btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.btn:not(:disabled):hover {
		background: #333;
		color: #fff;
	}

	.btn.secondary:not(:disabled):hover {
		background: #f1f5f9;
		color: #111;
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
