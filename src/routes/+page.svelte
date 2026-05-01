<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { siteState } from "$lib/siteState.svelte";

  let loading = $state(true);
  let error = $state("");

  async function startGeneration() {
    try {
      // Clear any previous state
      siteState.generatedHtml = "";
      siteState.styleGuide = null;
      siteState.hasGenerated = false;
      siteState.feedbackHistory = [];

      const styleRes = await fetch("/api/generate-style-guide", {
        method: "POST",
      });

      if (!styleRes.ok) {
        const errData = await styleRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Style API returned ${styleRes.status}`,
        );
      }

      const styleData = await styleRes.json();
      siteState.styleGuide = styleData.styleGuide;

      // Redirect to the new slug page
      // eslint-disable-next-line @sveltejs/valid-compile
      goto(`/${styleData.slug}`);
    } catch (err) {
      console.error("Error creating site:", err);
      error = (err as Error).message || "Failed to create site";
      loading = false;
    }
  }

  onMount(() => {
    startGeneration();
  });
</script>

<div class="takeover">
  {#if loading}
    <div class="loader-overlay">
      <h2>Generating your brand identity...</h2>
      <div class="spinner"></div>
    </div>
  {:else if error}
    <div class="error-overlay">
      <div class="error-card">
        <h2>Error Generating UI</h2>
        <p>{error}</p>
        {#if error.includes("AISTUDIO_API_KEY")}
          <div class="env-hint">AISTUDIO_API_KEY=your_key_here</div>
          <p class="small">Add this to your <code>.env</code> file.</p>
        {/if}
        <button class="retry-btn" onclick={() => startGeneration()}
          >Retry</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .takeover {
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
    background: #fcfcfc;
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

  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fcfcfc;
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

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
