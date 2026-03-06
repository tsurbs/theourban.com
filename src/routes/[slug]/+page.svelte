<script lang="ts">
    import { onMount } from "svelte";
    import { siteState } from "$lib/siteState.svelte";
    import type { PageData } from "./$types";
    import Wand2 from "lucide-svelte/icons/wand-2";
    import X from "lucide-svelte/icons/x";
    import LayoutGrid from "lucide-svelte/icons/layout-grid";

    let { data }: { data: PageData } = $props();

    let loading = $state(true); // Always true initially until we handle mount logic
    let error = $state("");
    let feedbackInput = $state("");
    let barCollapsed = $state(false);

    async function runGeneration() {
        const abortController = new AbortController();
        try {
            loading = true;
            error = "";

            const uiRes = await fetch("/api/generate-ui", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug: data.site.slug,
                    styleGuide: data.site.styleGuide,
                    feedbackHistory: data.site.feedbackHistory,
                    oldHtml: siteState.generatedHtml || data.site.generatedHtml,
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
        data.site.feedbackHistory = data.site.feedbackHistory || [];
        data.site.feedbackHistory.push(feedbackInput.trim());
        feedbackInput = "";
        runGeneration();
    }

    onMount(async () => {
        // If it's a completely new custom slug via URL
        if (data.isNew) {
            try {
                loading = true;
                const styleRes = await fetch("/api/generate-style-guide", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ themeWords: data.site.themeWords }),
                });

                if (!styleRes.ok)
                    throw new Error("Failed generating styles for custom slug");
                const styleData = await styleRes.json();

                // Update our local site data with the returned generated style guide
                data.site.styleGuide = styleData.styleGuide;
                data.site.slug = styleData.slug; // Ensure slug matches what is saved

                // Then generate the full UI
                runGeneration();
            } catch (err) {
                console.error(err);
                error = "Failed to bootstrap custom site generation";
                loading = false;
            }
        }
        // If there is HTML from DB, render it.
        else if (data.site.generatedHtml) {
            siteState.generatedHtml = data.site.generatedHtml;
            siteState.styleGuide = data.site.styleGuide as Record<string, unknown>;
            siteState.hasGenerated = true;
            siteState.feedbackHistory = data.site.feedbackHistory || [];
            loading = false;
        }
        // We have a record but no HTML (e.g., interrupted generation)
        else {
            runGeneration();
        }
    });

    let processedHtml = $derived.by(() => {
        if (!siteState.generatedHtml) return "";

        const injection = `
<script>
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href && !link.href.startsWith('#') && !link.href.startsWith(window.location.origin)) {
      e.preventDefault();
      window.top.location.href = link.href;
    }
  });
</script>
        `;

        // Inject before </body> if present, otherwise at the end
        if (siteState.generatedHtml.includes("</body>")) {
            return siteState.generatedHtml.replace(
                "</body>",
                `${injection}</body>`,
            );
        }
        return siteState.generatedHtml + injection;
    });
</script>

<div class="site-takeover">
    {#if loading}
        <div class="loader-overlay">
            <h2>Designing site structure...</h2>
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
        {#if !barCollapsed}
            <div class="feedback-overlay">
                <div class="input-container">
                    <button
                        class="icon-btn collapse-btn"
                        onclick={() => (barCollapsed = true)}
                        aria-label="Collapse"
                    >
                        <X size={16} />
                    </button>
                    <input
                        type="text"
                        bind:value={feedbackInput}
                        placeholder="Describe changes or feedback..."
                        onkeydown={(e) =>
                            e.key === "Enter" && handleRegenerate()}
                    />
                    <button
                        onclick={handleRegenerate}
                        disabled={!feedbackInput.trim()}
                        class="primary-btn"
                    >
                        Regenerate
                    </button>
                </div>
            </div>
        {/if}

        <div class="fab-container">
            {#if barCollapsed}
                <button
                    class="magic-fab"
                    onclick={() => (barCollapsed = false)}
                    aria-label="Expand Regenerate Bar"
                >
                    <Wand2 size={24} />
                </button>
            {/if}
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
            <a
                href="/gallery"
                class="magic-fab secondary"
                aria-label="Go to Gallery"
            >
                <LayoutGrid size={24} />
            </a>
        </div>

        <iframe srcdoc={processedHtml} title="Portfolio Site"></iframe>
    {/if}
</div>

<style>
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
        flex-direction: column;
        gap: 20px;
        align-items: center;
        justify-content: center;
        background: white;
        z-index: 100;
    }

    .loader-overlay h2 {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
        font-weight: 500;
        color: #333;
        margin: 0;
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
        align-items: center;
        gap: 10px;
        padding: 8px 8px 8px 16px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 999px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        animation: slideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1);
    }

    .icon-btn {
        background: none;
        border: none;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #666;
        border-radius: 50%;
        transition:
            background 0.2s,
            color 0.2s;
    }

    .icon-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #111;
    }

    .input-container input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 8px 8px;
        outline: none;
        font-size: 14px;
        color: #1a1a1a;
    }

    .primary-btn {
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

    .primary-btn:hover:not(:disabled) {
        background: #333;
        transform: translateY(-1px);
    }

    .primary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .fab-container {
        position: fixed;
        bottom: 30px;
        right: 30px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        z-index: 10000;
        animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .magic-fab {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #111;
        color: #fff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transition:
            transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275),
            background 0.2s;
        text-decoration: none;
    }

    .magic-fab.secondary {
        background: #fff;
        color: #111;
        border: 1px solid rgba(0, 0, 0, 0.1);
        width: 48px;
        height: 48px;
        margin-left: auto;
        margin-right: 4px; /* Center align with the 56px button */
    }

    .magic-fab:hover {
        transform: scale(1.1) translateY(-2px);
        background: #333;
        color: #fff;
    }

    @keyframes slideDown {
        from {
            transform: translateY(-20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes popIn {
        from {
            transform: scale(0.5);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
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
