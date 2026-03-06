<script lang="ts">
	import "../app.css";
	let { children } = $props();
</script>

<svelte:head>
	<title>Theo Urban</title>
</svelte:head>

<!-- This layout just provides global styles and the wrapper -->
{@render children?.()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
		background: #fcfcfc;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
			Helvetica, Arial, sans-serif;
	}
</style>
