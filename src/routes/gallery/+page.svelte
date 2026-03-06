<script lang="ts">
    import type { PageData } from "./$types";
    import { ThumbsUp } from "lucide-svelte";
    import { enhance } from "$app/forms";
    import { onMount } from "svelte";

    let { data }: { data: PageData } = $props();

    let votedSlugs = $state<string[]>([]);

    onMount(() => {
        const stored = localStorage.getItem("voted_sites");
        if (stored) {
            try {
                votedSlugs = JSON.parse(stored);
            } catch (e) {
                console.error(
                    "Failed to parse voted_sites from localStorage",
                    e,
                );
            }
        }
    });

    function handleVote(slug: string) {
        if (!votedSlugs.includes(slug)) {
            votedSlugs = [...votedSlugs, slug];
            localStorage.setItem("voted_sites", JSON.stringify(votedSlugs));
        }
    }

    // Fallback to white base if no style guide
    function getCardStyle(s: (typeof data.sites)[0]) {
        if (!s.styleGuide) return "";
        const guide = s.styleGuide as {
            backgroundColor?: string;
            primaryColor?: string;
            accentColor?: string;
            headingFont?: string;
        };
        return `
			background-color: ${guide.backgroundColor || "#ffffff"};
			color: ${guide.primaryColor || "#000000"};
			border-color: ${guide.accentColor || "#e2e8f0"};
			font-family: ${guide.headingFont || "sans-serif"};
		`;
    }
</script>

<svelte:head>
    <title>Site Gallery | Theo Urban</title>
</svelte:head>

<main class="gallery-container">
    <header class="gallery-header">
        <h1>Site Gallery</h1>
        <p>
            A collection of generated brand identities and layouts ({data.sites
                .length} total).
        </p>
        <a href="/" class="new-site-btn">Generate New Site</a>
    </header>

    {#if data.sites.length === 0}
        <div class="empty-state">
            No sites generated yet. <a href="/">Be the first</a>.
        </div>
    {:else}
        <div class="site-grid">
            {#each data.sites as site (site.slug)}
                <div class="card-wrapper">
                    <a
                        href={`/${site.slug}`}
                        class="site-card"
                        style={getCardStyle(site)}
                    >
                        <div class="card-content">
                            <h2>{site.themeWords}</h2>
                            <p class="slug">/{site.slug}</p>

                            {#if site.styleGuide}
                                <div class="colors">
                                    {#each Object.entries(site.styleGuide as Record<string, any>).filter(([k, v]) => k
                                                .toLowerCase()
                                                .includes("color") && typeof v === "string") as [key, color] (key)}
                                        <div class="color-swatch-container">
                                            <div
                                                class="color-swatch"
                                                style="background-color: {color};"
                                                title="{key}: {color}"
                                            ></div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            <div class="meta">
                                <span
                                    >{new Date(
                                        site.createdAt,
                                    ).toLocaleDateString()}</span
                                >
                                <span
                                    class="status-badge {site.generatedHtml
                                        ? 'ready'
                                        : 'empty'}"
                                >
                                    {site.generatedHtml
                                        ? "Generated"
                                        : "Pending UI"}
                                </span>
                            </div>
                        </div>
                        {#if site.styleGuide}
                            {@const guide = site.styleGuide as {
                                accentColor?: string;
                                backgroundColor?: string;
                                designSystemTheme?: string;
                            }}
                            <div
                                class="theme-tag"
                                style="background-color: {guide.accentColor ||
                                    '#333'}; color: {guide.backgroundColor ||
                                    '#fff'}"
                            >
                                {guide.designSystemTheme || "Custom Theme"}
                            </div>
                        {/if}
                    </a>

                    <div class="vote-overlay">
                        <form
                            method="POST"
                            action="?/thumbsUp"
                            use:enhance={() => {
                                handleVote(site.slug);
                                return async ({ update }) => {
                                    await update();
                                };
                            }}
                        >
                            <input
                                type="hidden"
                                name="slug"
                                value={site.slug}
                            />
                            <button
                                type="submit"
                                class="vote-btn"
                                disabled={votedSlugs.includes(site.slug)}
                                title={votedSlugs.includes(site.slug)
                                    ? "You already upvoted this site"
                                    : "Thumbs up this site"}
                            >
                                <ThumbsUp
                                    size={18}
                                    fill={votedSlugs.includes(site.slug)
                                        ? "currentColor"
                                        : "none"}
                                />
                                <span>{site.thumbsUps || 0}</span>
                            </button>
                        </form>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
    .gallery-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
    }

    .gallery-header {
        text-align: center;
        margin-bottom: 50px;
    }

    .gallery-header h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
        color: #111;
    }

    .gallery-header p {
        color: #666;
        font-size: 1.1rem;
        margin-bottom: 20px;
    }

    .new-site-btn {
        display: inline-block;
        padding: 10px 24px;
        background: #111;
        color: #fff;
        text-decoration: none;
        border-radius: 999px;
        font-weight: 500;
        transition:
            transform 0.2s,
            background 0.2s;
    }

    .new-site-btn:hover {
        background: #333;
        transform: translateY(-2px);
    }

    .site-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 30px;
    }

    .card-wrapper {
        position: relative;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .card-wrapper:hover {
        transform: translateY(-8px);
    }

    .site-card {
        display: block;
        text-decoration: none;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid #eaeaea;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        transition: box-shadow 0.3s;
        min-height: 240px;
        display: flex;
        flex-direction: column;
    }

    .card-wrapper:hover .site-card {
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
    }

    .card-content {
        padding: 30px 24px;
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .site-card h2 {
        margin: 0 0 8px 0;
        font-size: 1.5rem;
        line-height: 1.2;
        text-transform: capitalize;
    }

    .slug {
        margin: 0 0 20px 0;
        font-size: 0.9rem;
        opacity: 0.7;
        font-family: monospace;
    }

    .colors {
        display: flex;
        gap: 8px;
        margin-top: auto;
        margin-bottom: 20px;
    }

    .color-swatch-container {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .color-swatch {
        width: 100%;
        height: 100%;
    }

    .meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        opacity: 0.8;
        margin-top: auto;
    }

    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 500;
    }

    .status-badge.ready {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
    }

    .status-badge.empty {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
    }

    .theme-tag {
        position: absolute;
        top: 0;
        right: 0;
        padding: 6px 12px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-bottom-left-radius: 12px;
    }

    .vote-overlay {
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 10;
    }

    .vote-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(4px);
        border: 1px solid #ddd;
        border-radius: 999px;
        font-size: 0.9rem;
        font-weight: 600;
        color: #333;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .vote-btn:hover:not(:disabled) {
        background: #fff;
        border-color: #111;
        transform: scale(1.05);
    }

    .vote-btn:disabled {
        opacity: 0.7;
        cursor: default;
        background: #f0f0f0;
        color: #111;
    }

    .empty-state {
        text-align: center;
        padding: 80px 20px;
        color: #666;
        background: #f9f9f9;
        border-radius: 12px;
        border: 1px dashed #ccc;
    }

    .empty-state a {
        color: #111;
        font-weight: 600;
    }
</style>
