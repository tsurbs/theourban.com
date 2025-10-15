<script lang="ts">
  export let data: {
    streamed: {
      backend_isalive: Promise<string>;
    };
  };
  export let question = "Hello?";
  const backend_url = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

  let lines: string[] = [];
  let loading = false;
  let controller: AbortController | null = null;

  async function startStream() {
    lines = [];
    loading = true;
    controller = new AbortController();

    try {
      const query = new URLSearchParams({ question });
      const streamedAnswer = fetch(
        `${backend_url}/chat?` + query.toString(),
        { method: "POST" }
      ); // Awaited before initial render

      const res = await streamedAnswer;
      if (!res.body) throw new Error("Streaming not supported");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const chunk = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (chunk) lines = [...lines, chunk]; // update UI incrementally
        }
      }

      const leftover = buffer.trim();
      if (leftover) lines = [...lines, leftover];
    } catch (err) {
      lines = [...lines, `Error: ${String(err)}`];
    } finally {
      loading = false;
    }
  }

  function stopStream() {
    controller?.abort();
    controller = null;
    loading = false;
  }
</script>

<div class="relative top-[25vh] left-[25vh]">
  <p>Hi, I'm</p>
  <h1 style="color: var(--color-accent); font-size: 3rem; font-weight: bold;">Theo Urban</h1>
  <p>... but if you’re here, you probably know that....</p>
  <p>So, why don’t you ask what you want to know?</p>
</div>
<h1>Initial Data: {question}</h1>
<!-- on submit set question to the query value in the form -->
<form
  on:submit|preventDefault={(e) => {
	const formData = new FormData(e.target as HTMLFormElement);
	question = formData.get("question") as string;
	startStream();
  }}>
  <input name="question" type="text" bind:value={question} />
  <button type="submit" disabled={loading}>Ask</button>
  {#if loading}
	<button type="button" on:click={stopStream}>Stop</button>
  {/if}
  {#await data.streamed.backend_isalive}
    <p>Backend is loading</p>
    {:catch err}
	  <p style="color: red;">Backend is not reachable</p>
    {:then backend_status}
	<p>Backend status: {backend_status}</p>
  {/await}
</form>

<!-- display streamed data -->
<h2>Streamed Completion:</h2>
{#if lines.length === 0}
  <p>No data yet. Ask a question!</p>
{:else}
  <div style="white-space: pre-wrap; border: 1px solid #ccc; padding: 10px; max-height: 300px; overflow-y: auto;">
	{#each lines as line}
	  {line}
	{/each}
  </div>
{/if}