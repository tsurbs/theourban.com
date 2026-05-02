<script lang="ts">
    import { onMount } from "svelte";
    import { siteState } from "$lib/siteState.svelte";
    import type { GenerationCallStats } from "$lib/generationStats";
    import type { PageData } from "./$types";
    import type { SiteNerdGlobalPayload } from "$lib/server/siteGenerationEvents";
    import Wand2 from "lucide-svelte/icons/wand-2";
    import X from "lucide-svelte/icons/x";
    import LayoutGrid from "lucide-svelte/icons/layout-grid";
    import ThumbsUp from "lucide-svelte/icons/thumbs-up";
    import { enhance } from "$app/forms";
    import { ensurePreviewContentSecurityPolicy } from "$lib/previewSecurity";

    const CONTEXT_MSG = "theourban-contextmenu";

    let { data }: { data: PageData } = $props();

    let loading = $state(true); // Always true initially until we handle mount logic
    let error = $state("");
    let feedbackInput = $state("");
    let barCollapsed = $state(false);
    let votedSlugs = $state<string[]>([]);
    let contextMenuOpen = $state(false);
    let contextMenuX = $state(0);
    let contextMenuY = $state(0);
    let nerdsModalOpen = $state(false);
    let nerdGlobal = $state<SiteNerdGlobalPayload>(data.nerdGlobal);
    let nerdsExpandedId = $state<string | null>(null);

    $effect(() => {
        nerdGlobal = data.nerdGlobal;
    });

    async function refreshNerdGlobalFromServer() {
        const slug = data.site.slug;
        if (!slug) return;
        try {
            const r = await fetch(
                `/api/sites/${encodeURIComponent(slug)}/nerd-stats`,
            );
            if (r.ok) {
                nerdGlobal = (await r.json()) as SiteNerdGlobalPayload;
            }
        } catch (e) {
            console.error("refresh nerd stats", e);
        }
    }

    function fmtUsd(n: number) {
        return n.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: n < 0.01 ? 6 : 4,
        });
    }

    function tokensPerSecond(stats: GenerationCallStats) {
        const sec = stats.durationMs / 1000;
        return sec > 0 ? stats.totalTokenCount / sec : 0;
    }

    const nerdsAggregate = $derived.by(() => {
        const sg = siteState.generationStats.styleGuide;
        const ui = siteState.generationStats.ui;
        const parts: GenerationCallStats[] = [];
        if (sg) parts.push(sg);
        if (ui) parts.push(ui);
        const totalTokens = parts.reduce((a, s) => a + s.totalTokenCount, 0);
        const totalCost = parts.reduce((a, s) => a + s.estimatedCostUsd, 0);
        const totalMs = parts.reduce((a, s) => a + s.durationMs, 0);
        const sec = totalMs / 1000;
        const tpsCombined = sec > 0 ? totalTokens / sec : 0;
        return { parts, totalTokens, totalCost, totalMs, sec, tpsCombined };
    });

    const nerdsHasAnything = $derived(
        nerdsAggregate.parts.length > 0 ||
            nerdGlobal.aggregates.callCount > 0 ||
            nerdGlobal.recentEvents.length > 0,
    );

    function truncateSummary(s: string, max = 140) {
        const t = s.trim();
        if (t.length <= max) return t;
        return t.slice(0, max - 1) + "…";
    }

    function fmtShortTime(iso: string) {
        try {
            return new Date(iso).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
        } catch {
            return iso;
        }
    }

    function copyNerdsExport() {
        const payload = {
            exportedAt: new Date().toISOString(),
            slug: data.site.slug,
            allUsersThisSite: nerdGlobal,
            yourLatestSnapshot: siteState.generationStats,
        };
        void navigator.clipboard?.writeText(
            JSON.stringify(payload, null, 2),
        );
    }

    function openContextMenuAt(clientX: number, clientY: number) {
        contextMenuX = clientX;
        contextMenuY = clientY;
        contextMenuOpen = true;
    }

    function handleRootContextMenu(e: MouseEvent) {
        const t = e.target as HTMLElement | null;
        if (t?.closest("iframe")) return;
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY);
    }

    function openNerdsModal() {
        nerdsModalOpen = true;
        contextMenuOpen = false;
        void refreshNerdGlobalFromServer();
    }

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

            if (uiData.stats) {
                siteState.generationStats.ui = uiData.stats;
            }

            siteState.generatedHtml = uiData.html;
            siteState.hasGenerated = true;
            loading = false;
            await refreshNerdGlobalFromServer();
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
            console.error("Error in generation flow:", err);
            error = (err as Error).message || "Failed to generate UI";
            loading = false;
        }
    }

    function handleRegenerate() {
        const line = feedbackInput.trim();
        if (!line) return;
        data.site.feedbackHistory = data.site.feedbackHistory || [];
        data.site.feedbackHistory.push(line);
        feedbackInput = "";
        runGeneration();
    }

    function handleVote(slug: string) {
        if (!votedSlugs.includes(slug)) {
            votedSlugs = [...votedSlugs, slug];
            localStorage.setItem("voted_sites", JSON.stringify(votedSlugs));
            data.site.thumbsUps = (data.site.thumbsUps || 0) + 1;
        }
    }

    onMount(() => {
        function onIframeContextMenuMsg(ev: MessageEvent) {
            if (ev.data?.type !== CONTEXT_MSG) return;
            const iframe = document.querySelector(
                ".site-takeover iframe",
            ) as HTMLIFrameElement | null;
            if (!iframe) return;
            const rect = iframe.getBoundingClientRect();
            openContextMenuAt(
                rect.left + ev.data.clientX,
                rect.top + ev.data.clientY,
            );
        }
        window.addEventListener("message", onIframeContextMenuMsg);

        function onKeydown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                nerdsModalOpen = false;
                contextMenuOpen = false;
            }
        }
        window.addEventListener("keydown", onKeydown);

        void (async () => {
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

            if (data.isNew) {
                siteState.generationStats = { ui: null, styleGuide: null };
                try {
                    loading = true;
                    const styleRes = await fetch("/api/generate-style-guide", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            themeWords: data.site.themeWords,
                        }),
                    });

                    if (!styleRes.ok)
                        throw new Error(
                            "Failed generating styles for custom slug",
                        );
                    const styleData = await styleRes.json();

                    if (styleData.stats) {
                        siteState.generationStats.styleGuide = styleData.stats;
                    }

                    data.site.styleGuide = styleData.styleGuide;
                    data.site.slug = styleData.slug;

                    await refreshNerdGlobalFromServer();
                    runGeneration();
                } catch (err) {
                    console.error(err);
                    error = "Failed to bootstrap custom site generation";
                    loading = false;
                }
            } else if (data.site.generatedHtml) {
                siteState.generationStats = { ui: null, styleGuide: null };
                siteState.generatedHtml = data.site.generatedHtml;
                siteState.styleGuide = data.site.styleGuide as Record<
                    string,
                    unknown
                >;
                siteState.hasGenerated = true;
                siteState.feedbackHistory = data.site.feedbackHistory || [];
                loading = false;
            } else {
                siteState.generationStats = { ui: null, styleGuide: null };
                runGeneration();
            }
        })();

        return () => {
            window.removeEventListener("message", onIframeContextMenuMsg);
            window.removeEventListener("keydown", onKeydown);
        };
    });

    let processedHtml = $derived.by(() => {
        if (!siteState.generatedHtml) return "";

        const htmlWithCsp = ensurePreviewContentSecurityPolicy(
            siteState.generatedHtml,
        );

        const po = JSON.stringify(data.previewOrigin ?? "");
        const pv = JSON.stringify(data.previewPathname ?? "");

        const injection =
            "<script>\n" +
            "  const PO=" +
            po +
            ";\n" +
            "  const PV=" +
            pv +
            ";\n" +
            "  function normPath(p){while(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);return p||'/';}\n" +
            "  document.addEventListener('click', (e) => {\n" +
            "    const link = e.target.closest('a');\n" +
            "    if (!link || !link.href) return;\n" +
            "    const raw = (link.getAttribute('href') || '').trim();\n" +
            "    if (!raw || raw.startsWith('#')) return;\n" +
            "    if (/^(javascript:|mailto:|tel:)/i.test(raw)) return;\n" +
            "    const tgt = (link.getAttribute('target') || '').toLowerCase();\n" +
            "    if (tgt === '_blank') return;\n" +
            "    let u;\n" +
            "    try { u = new URL(link.href); } catch (_) { return; }\n" +
            "    if (PO && u.origin === PO && normPath(u.pathname) === normPath(PV)) {\n" +
            "      e.preventDefault();\n" +
            "      window.location.hash = u.hash || '#top';\n" +
            "      return;\n" +
            "    }\n" +
            "    e.preventDefault();\n" +
            "    window.top.location.href = link.href;\n" +
            "  });\n" +
            "  document.addEventListener('contextmenu', (e) => {\n" +
            "    e.preventDefault();\n" +
            "    window.parent.postMessage({ type: '" +
            CONTEXT_MSG +
            "', clientX: e.clientX, clientY: e.clientY }, '*');\n" +
            "  });\n" +
            "<" +
            "/script>\n";

        // Inject before </body> if present, otherwise at the end
        if (htmlWithCsp.includes("</body>")) {
            return htmlWithCsp.replace("</body>", injection + "</body>");
        }
        return htmlWithCsp + injection;
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="site-takeover" oncontextmenu={handleRootContextMenu}>
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
                {#if error.includes("AISTUDIO_API_KEY")}
                    <div class="env-hint">AISTUDIO_API_KEY=your_key_here</div>
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

            {#if !data.isNew}
                <form
                    method="POST"
                    action="/gallery?/thumbsUp"
                    use:enhance={() => {
                        handleVote(data.site.slug);
                        return async ({ update }) => {
                            await update();
                        };
                    }}
                >
                    <input type="hidden" name="slug" value={data.site.slug} />
                    <button
                        type="submit"
                        class="magic-fab vote-fab"
                        disabled={votedSlugs.includes(data.site.slug)}
                        title={votedSlugs.includes(data.site.slug)
                            ? "You already upvoted this site"
                            : "Thumbs up this site"}
                    >
                        <ThumbsUp
                            size={24}
                            fill={votedSlugs.includes(data.site.slug)
                                ? "currentColor"
                                : "none"}
                        />
                        <span class="vote-count"
                            >{data.site.thumbsUps || 0}</span
                        >
                    </button>
                </form>
            {/if}
        </div>

        <iframe
            srcdoc={processedHtml}
            title="Portfolio Site"
            sandbox="allow-scripts allow-forms allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-same-origin"
            referrerpolicy="no-referrer"
        ></iframe>
    {/if}

    {#if contextMenuOpen}
        <div
            class="context-backdrop"
            role="presentation"
            onclick={() => (contextMenuOpen = false)}
        ></div>
        <div
            class="context-menu"
            style="left: {contextMenuX}px; top: {contextMenuY}px;"
            role="menu"
        >
            <button type="button" role="menuitem" onclick={openNerdsModal}>
                Stats for nerds
            </button>
        </div>
    {/if}

    {#if nerdsModalOpen}
        <div
            class="nerds-modal-backdrop"
            role="presentation"
            onclick={() => (nerdsModalOpen = false)}
        ></div>
        <div
            class="nerds-modal"
            role="dialog"
            aria-labelledby="nerds-title"
            tabindex="-1"
        >
            <div class="nerds-modal-header">
                <div class="nerds-modal-title-wrap">
                    <h2 id="nerds-title">Stats for nerds</h2>
                    {#if data.site.slug}
                        <p class="nerds-modal-slug">
                            Site <code>/{data.site.slug}</code> — global totals
                            and history below are pooled from the database across
                            all visitors (anonymized; no accounts).
                        </p>
                    {/if}
                </div>
                <button
                    type="button"
                    class="nerds-close"
                    onclick={() => (nerdsModalOpen = false)}
                    aria-label="Close"
                >
                    <X size={18} />
                </button>
            </div>
            {#if !nerdsHasAnything}
                <p class="nerds-empty">
                    No Gemini stats yet for <code>/{data.site.slug || "…"}</code>.
                    After generations run, this panel shows totals and a shared
                    prompt log from the server for everyone who visits this slug.
                </p>
            {:else}
                {#if nerdGlobal.aggregates.callCount > 0}
                    <section class="nerds-lifetime">
                        <h3>All visitors (this site)</h3>
                        <dl class="nerds-dl">
                            <dt>Gemini calls recorded</dt>
                            <dd>
                                {nerdGlobal.aggregates.callCount.toLocaleString()}
                            </dd>
                            <dt>Total tokens (all users)</dt>
                            <dd>
                                {nerdGlobal.aggregates.totalTokens.toLocaleString()}
                            </dd>
                            <dt>Est. total spend (all users)</dt>
                            <dd>{fmtUsd(nerdGlobal.aggregates.totalCostUsd)}</dd>
                            {#if nerdGlobal.aggregates.lastEventAt}
                                <dt>Most recent event</dt>
                                <dd>
                                    {fmtShortTime(
                                        nerdGlobal.aggregates.lastEventAt,
                                    )}
                                </dd>
                            {/if}
                        </dl>
                    </section>
                {/if}

                <div class="nerds-sections">
                    {#if siteState.generationStats.styleGuide}
                        {@const s = siteState.generationStats.styleGuide}
                        <section>
                            <h3>Your latest style guide call</h3>
                            <dl class="nerds-dl">
                                {#if s.model}
                                    <dt>Model</dt>
                                    <dd class="nerds-mono">{s.model}</dd>
                                {/if}
                                <dt>Prompt tokens</dt>
                                <dd>{s.promptTokenCount.toLocaleString()}</dd>
                                <dt>Output tokens</dt>
                                <dd>{s.candidatesTokenCount.toLocaleString()}</dd>
                                {#if s.thoughtsTokenCount != null && s.thoughtsTokenCount > 0}
                                    <dt>Thought tokens</dt>
                                    <dd>
                                        {s.thoughtsTokenCount.toLocaleString()}
                                    </dd>
                                {/if}
                                {#if s.cachedContentTokenCount != null && s.cachedContentTokenCount > 0}
                                    <dt>Cached content tokens</dt>
                                    <dd>
                                        {s.cachedContentTokenCount.toLocaleString()}
                                    </dd>
                                {/if}
                                <dt>Total tokens</dt>
                                <dd>{s.totalTokenCount.toLocaleString()}</dd>
                                <dt>Wall time</dt>
                                <dd>{(s.durationMs / 1000).toFixed(2)} s</dd>
                                <dt>Tokens / second</dt>
                                <dd>
                                    {tokensPerSecond(s).toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                    })}
                                </dd>
                                <dt>Est. cost (3.1 Flash-Lite)</dt>
                                <dd>{fmtUsd(s.estimatedCostUsd)}</dd>
                            </dl>
                        </section>
                    {/if}
                    {#if siteState.generationStats.ui}
                        {@const s = siteState.generationStats.ui}
                        <section>
                            <h3>Your latest UI generation</h3>
                            <dl class="nerds-dl">
                                {#if s.model}
                                    <dt>Model</dt>
                                    <dd class="nerds-mono">{s.model}</dd>
                                {/if}
                                <dt>Prompt tokens</dt>
                                <dd>{s.promptTokenCount.toLocaleString()}</dd>
                                <dt>Output tokens</dt>
                                <dd>{s.candidatesTokenCount.toLocaleString()}</dd>
                                {#if s.thoughtsTokenCount != null && s.thoughtsTokenCount > 0}
                                    <dt>Thought tokens</dt>
                                    <dd>
                                        {s.thoughtsTokenCount.toLocaleString()}
                                    </dd>
                                {/if}
                                {#if s.cachedContentTokenCount != null && s.cachedContentTokenCount > 0}
                                    <dt>Cached content tokens</dt>
                                    <dd>
                                        {s.cachedContentTokenCount.toLocaleString()}
                                    </dd>
                                {/if}
                                <dt>Total tokens</dt>
                                <dd>{s.totalTokenCount.toLocaleString()}</dd>
                                <dt>Wall time</dt>
                                <dd>{(s.durationMs / 1000).toFixed(2)} s</dd>
                                <dt>Tokens / second</dt>
                                <dd>
                                    {tokensPerSecond(s).toLocaleString(undefined, {
                                        maximumFractionDigits: 1,
                                    })}
                                </dd>
                                <dt>Est. cost (3.1 Flash-Lite)</dt>
                                <dd>{fmtUsd(s.estimatedCostUsd)}</dd>
                            </dl>
                        </section>
                    {/if}
                </div>
                {#if nerdsAggregate.parts.length > 1}
                    <section class="nerds-combined">
                        <h3>Your combined snapshot (this tab)</h3>
                        <dl class="nerds-dl">
                            <dt>Total tokens</dt>
                            <dd>
                                {nerdsAggregate.totalTokens.toLocaleString()}
                            </dd>
                            <dt>Total wall time</dt>
                            <dd>{nerdsAggregate.sec.toFixed(2)} s</dd>
                            <dt>Tokens / second</dt>
                            <dd>
                                {nerdsAggregate.tpsCombined.toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 1 },
                                )}
                            </dd>
                            <dt>Est. total cost</dt>
                            <dd>{fmtUsd(nerdsAggregate.totalCost)}</dd>
                        </dl>
                    </section>
                {/if}

                {#if nerdGlobal.recentEvents.length > 0}
                    <section class="nerds-prompts">
                        <div class="nerds-prompts-head">
                            <h3>Recent generations (all visitors)</h3>
                        </div>
                        <p class="nerds-prompts-hint">
                            Newest first (up to 80 rows). Summaries may include
                            theme titles or feedback text submitted with a
                            regenerate.
                        </p>
                        <ul class="nerds-prompt-list">
                            {#each nerdGlobal.recentEvents as entry (entry.id)}
                                <li class="nerds-prompt-item">
                                    <button
                                        type="button"
                                        class="nerds-prompt-toggle"
                                        class:open={nerdsExpandedId === entry.id}
                                        onclick={() =>
                                            (nerdsExpandedId =
                                                nerdsExpandedId === entry.id
                                                    ? null
                                                    : entry.id)}
                                        aria-expanded={nerdsExpandedId === entry.id}
                                    >
                                        <span
                                            class="nerds-kind nerds-kind-{entry.kind}"
                                            >{entry.kind === "style-guide"
                                                ? "Style"
                                                : "UI"}</span
                                        >
                                        <span class="nerds-prompt-meta">
                                            {fmtShortTime(entry.createdAt)} · {entry.totalTokenCount.toLocaleString()}
                                            tok
                                        </span>
                                        <span class="nerds-chevron" aria-hidden="true"
                                            >{nerdsExpandedId === entry.id
                                                ? "▾"
                                                : "▸"}</span
                                        >
                                    </button>
                                    {#if nerdsExpandedId !== entry.id}
                                        <p class="nerds-prompt-preview">
                                            {truncateSummary(entry.summary)}
                                        </p>
                                    {:else}
                                        <pre class="nerds-prompt-body">{entry.summary}</pre>
                                        <dl class="nerds-dl nerds-prompt-mini">
                                            <dt>Slug</dt>
                                            <dd class="nerds-mono">
                                                {entry.siteSlug}
                                            </dd>
                                            <dt>Prompt / out</dt>
                                            <dd>
                                                {entry.promptTokenCount.toLocaleString()}
                                                /
                                                {entry.candidatesTokenCount.toLocaleString()}
                                            </dd>
                                            {#if entry.model}
                                                <dt>Model</dt>
                                                <dd class="nerds-mono">
                                                    {entry.model}
                                                </dd>
                                            {/if}
                                        </dl>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </section>
                {/if}

                <div class="nerds-actions">
                    <button type="button" class="nerds-btn" onclick={copyNerdsExport}>
                        Copy stats JSON
                    </button>
                </div>

                <p class="nerds-footnote">
                    {siteState.generationStats.ui?.pricingNote ??
                        siteState.generationStats.styleGuide?.pricingNote ??
                        (nerdGlobal.aggregates.callCount > 0
                            ? "Server totals are sums of recorded usage metadata across all sessions. "
                            : "")}
                    <a
                        href="https://ai.google.dev/pricing"
                        target="_blank"
                        rel="noreferrer">ai.google.dev/pricing</a
                    >
                </p>
            {/if}
        </div>
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

    .magic-fab.vote-fab {
        background: #fff;
        color: #111;
        border: 1px solid rgba(0, 0, 0, 0.1);
        width: 56px;
        height: 56px;
        position: relative;
    }

    .vote-count {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #111;
        color: #fff;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 999px;
        min-width: 18px;
        text-align: center;
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

    .context-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10050;
        background: transparent;
    }

    .context-menu {
        position: fixed;
        z-index: 10051;
        min-width: 180px;
        padding: 4px 0;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
    }

    .context-menu button {
        display: block;
        width: 100%;
        padding: 10px 14px;
        border: none;
        background: none;
        text-align: left;
        font-size: 14px;
        color: #1a1a1a;
        cursor: pointer;
        font-family: inherit;
    }

    .context-menu button:hover {
        background: rgba(0, 0, 0, 0.06);
    }

    .nerds-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10055;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(2px);
    }

    .nerds-modal {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 10056;
        width: min(560px, calc(100vw - 32px));
        max-height: min(88vh, 720px);
        overflow: auto;
        padding: 20px 22px 18px;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
    }

    .nerds-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
    }

    .nerds-modal-title-wrap {
        flex: 1;
        min-width: 0;
    }

    .nerds-modal-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #111;
    }

    .nerds-modal-slug {
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 1.45;
        color: #666;
    }

    .nerds-modal-slug code {
        font-size: 11px;
        background: rgba(0, 0, 0, 0.06);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .nerds-close {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.06);
        color: #333;
        cursor: pointer;
    }

    .nerds-close:hover {
        background: rgba(0, 0, 0, 0.1);
    }

    .nerds-sections {
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .nerds-sections section h3,
    .nerds-combined h3 {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #666;
    }

    .nerds-dl {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px 16px;
        margin: 0;
        font-size: 14px;
    }

    .nerds-dl dt {
        margin: 0;
        color: #555;
    }

    .nerds-dl dd {
        margin: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: #111;
        font-weight: 500;
    }

    .nerds-dl dd.nerds-mono {
        font-size: 12px;
        font-weight: 400;
        word-break: break-all;
    }

    .nerds-lifetime {
        margin-bottom: 18px;
    }

    .nerds-lifetime h3 {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #666;
    }

    .nerds-prompts {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .nerds-prompts-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
    }

    .nerds-prompts-head h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #666;
    }

    .nerds-prompts-hint {
        margin: 0 0 12px;
        font-size: 12px;
        color: #666;
        line-height: 1.4;
    }

    .nerds-prompt-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 280px;
        overflow: auto;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 10px;
    }

    .nerds-prompt-item {
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .nerds-prompt-item:last-child {
        border-bottom: none;
    }

    .nerds-prompt-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: rgba(0, 0, 0, 0.02);
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        font-size: 13px;
    }

    .nerds-prompt-toggle:hover {
        background: rgba(0, 0, 0, 0.04);
    }

    .nerds-kind {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 3px 7px;
        border-radius: 4px;
    }

    .nerds-kind-style-guide {
        background: #ede9fe;
        color: #5b21b6;
    }

    .nerds-kind-ui {
        background: #dbeafe;
        color: #1d4ed8;
    }

    .nerds-prompt-meta {
        flex: 1;
        font-size: 11px;
        color: #666;
        font-variant-numeric: tabular-nums;
    }

    .nerds-chevron {
        flex-shrink: 0;
        color: #888;
        font-size: 12px;
    }

    .nerds-prompt-preview {
        margin: 0;
        padding: 0 12px 10px 12px;
        font-size: 12px;
        color: #444;
        line-height: 1.45;
    }

    .nerds-prompt-body {
        margin: 0 12px 10px;
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.45;
        background: #f6f6f6;
        border-radius: 8px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
    }

    .nerds-prompt-mini {
        margin: 0 12px 12px;
        font-size: 12px;
    }

    .nerds-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .nerds-btn {
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #fff;
        color: #222;
        cursor: pointer;
        font-family: inherit;
    }

    .nerds-btn:hover {
        background: rgba(0, 0, 0, 0.04);
    }

    .nerds-combined {
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .nerds-footnote {
        margin: 16px 0 0;
        font-size: 11px;
        line-height: 1.45;
        color: #777;
    }

    .nerds-footnote a {
        color: #333;
        margin-left: 4px;
    }

    .nerds-empty {
        margin: 0;
        font-size: 14px;
        color: #555;
        line-height: 1.5;
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
