<script lang="ts">
    import type { PageData } from "./$types";
    import { ThumbsUp, Search, X } from "lucide-svelte";
    import { enhance } from "$app/forms";
    import { onMount } from "svelte";

    let { data }: { data: PageData } = $props();

    let votedSlugs = $state<string[]>([]);
    let searchQuery = $state("");
    let sortBy = $state<"new" | "liked">("liked");

    let filteredSites = $derived(
        data.sites
            .filter(
                (s) =>
                    s.themeWords
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    s.slug.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .sort((a, b) => {
                if (sortBy === "liked") {
                    return (b.thumbsUps || 0) - (a.thumbsUps || 0);
                } else {
                    return (
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    );
                }
            }),
    );

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

    <div class="filter-controls">
        <div class="search-input-wrapper">
            <div class="search-icon-wrapper">
                <Search size={20} />
            </div>
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search by theme or slug..."
                class="search-input"
            />
            {#if searchQuery}
                <button
                    class="clear-btn"
                    onclick={() => (searchQuery = "")}
                    aria-label="Clear search"
                >
                    <X size={18} />
                </button>
            {/if}
        </div>

        <div class="sort-wrapper">
            <label for="sort-by">Sort by:</label>
            <select id="sort-by" bind:value={sortBy} class="sort-select">
                <option value="liked">Most Liked</option>
                <option value="new">Newest First</option>
            </select>
        </div>
        <div class="results-count">
            Showing {filteredSites.length} of {data.sites.length} sites
        </div>
    </div>

    {#if data.sites.length === 0}
        <div class="empty-state">
            No sites generated yet. <a href="/">Be the first</a>.
        </div>
    {:else if filteredSites.length === 0}
        <div class="empty-state">
            No sites match your search "{searchQuery}".
            <button class="text-btn" onclick={() => (searchQuery = "")}
                >Clear filters</button
            >.
        </div>
    {:else}
        <div class="site-grid">
            {#each filteredSites as site (site.slug)}
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
                                    {#each Object.entries(site.styleGuide as Record<string, unknown>).filter(([k, v]) => k
                                                .toLowerCase()
                                                .includes("color") && typeof v === "string") as [key, color] (key)}
                                        <div class="color-swatch-container">
                                            <div
                                                class="color-swatch"
                                                style="background-color: {color as string};"
                                                title="{key}: {color as string}"
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
        margin-bottom: 30px;
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

    .filter-controls {
        position: sticky;
        top: 20px;
        z-index: 100;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(12px);
        padding: 20px;
        margin-bottom: 40px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 24px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        width: 100%;
        max-width: 1000px;
        margin: 0 auto;
        border-radius: 20px;
        flex-wrap: wrap;
    }

    .sort-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        color: #555;
    }

    .sort-select {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #ddd;
        background: #fff;
        font-size: 0.9rem;
        cursor: pointer;
        transition: border-color 0.2s;
    }

    .sort-select:focus {
        outline: none;
        border-color: #111;
    }

    .search-input-wrapper {
        position: relative;
        width: 100%;
        max-width: 500px;
        display: flex;
        align-items: center;
    }

    .search-icon-wrapper {
        position: absolute;
        left: 16px;
        color: #999;
        pointer-events: none;
        display: flex;
        align-items: center;
    }

    .search-input {
        width: 100%;
        padding: 14px 44px 14px 48px;
        border-radius: 999px;
        border: 1px solid #ddd;
        background: #fff;
        font-size: 1rem;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .search-input:focus {
        outline: none;
        border-color: #111;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .clear-btn {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }

    .clear-btn:hover {
        background: #f0f0f0;
        color: #333;
    }

    .results-count {
        font-size: 0.85rem;
        color: #777;
        font-weight: 500;
        width: 100%;
        text-align: center;
        margin-top: 8px;
    }

    .site-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 30px;
        padding-bottom: 40px;
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

    .text-btn {
        background: none;
        border: none;
        color: #111;
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
    }

    .empty-state a {
        color: #111;
        font-weight: 600;
    }
</style>
