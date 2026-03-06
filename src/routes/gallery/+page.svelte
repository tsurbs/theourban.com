<script lang="ts">
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // Fallback to white base if no style guide
    function getCardStyle(s: (typeof data.sites)[0]) {
        if (!s.styleGuide) return "";
        const guide: any = s.styleGuide;
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
            {#each data.sites as site}
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
                                {#each Object.entries(site.styleGuide as any).filter(([k, v]) => k
                                            .toLowerCase()
                                            .includes("color") && typeof v === "string") as [key, color]}
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
                        <div
                            class="theme-tag"
                            style="background-color: {(site.styleGuide as any)
                                .accentColor || '#333'}; color: {(
                                site.styleGuide as any
                            ).backgroundColor || '#fff'}"
                        >
                            {(site.styleGuide as any).designSystemTheme ||
                                "Custom Theme"}
                        </div>
                    {/if}
                </a>
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

    .site-card {
        display: block;
        text-decoration: none;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid #eaeaea;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        transition:
            transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
            box-shadow 0.3s;
        position: relative;
        min-height: 240px;
        display: flex;
        flex-direction: column;
    }

    .site-card:hover {
        transform: translateY(-8px);
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
