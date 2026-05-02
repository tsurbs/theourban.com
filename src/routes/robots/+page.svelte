<script lang="ts">
	import type { PageData } from "./$types";
	import content from "$lib/assets/content.json";

	let { data }: { data: PageData } = $props();

	const origin = data.siteOrigin.replace(/\/$/, "");
	const canonical = `${origin}/robots`;

	const sameAs = content.links.map((l) => l.url).filter((u) => /^https?:\/\//i.test(u));

	const structuredData = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Person",
				"@id": `${origin}/robots#person`,
				name: content.name,
				url: canonical,
				sameAs,
				jobTitle: "Student, Carnegie Mellon University",
				description: content.headline,
			},
			{
				"@type": "WebSite",
				"@id": `${origin}/robots#website`,
				url: origin,
				name: "Theo Urban",
				description:
					"Generative portfolio site: Theo Urban — AI & CS student at Carnegie Mellon (ScottyLabs, projects, contact).",
				publisher: { "@id": `${origin}/robots#person` },
			},
		],
	};
</script>

<svelte:head>
	<title>Theo Urban — portfolio (text sample for crawlers)</title>
	<meta
		name="description"
		content="Theo Urban: AI major at CMU, ScottyLabs, software projects, and links. Static text sample for search engines and previews."
	/>
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="profile" />
	<meta property="og:title" content="Theo Urban — portfolio (crawler sample)" />
	<meta
		property="og:description"
		content="AI & CS at Carnegie Mellon. ScottyLabs, projects, GitHub, resume, and contact — indexable summary."
	/>
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={`${origin}${content.profile_pic}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={`${origin}${content.profile_pic}`} />
	<meta name="twitter:title" content="Theo Urban — portfolio sample" />
	<meta
		name="twitter:description"
		content="Indexable biography and project list for theourban.com — generative portfolio experiment."
	/>
	<svelte:element this={"script"} type="application/ld+json">
		{JSON.stringify(structuredData)}
	</svelte:element>
</svelte:head>

<article class="doc">
	<header class="doc-header">
		<p class="kicker">Indexable sample — same facts as the live site</p>
		<h1>{content.name}</h1>
		<p class="lead">{content.headline}</p>
		<figure class="photo">
			<img
				src={`${origin}${content.profile_pic}`}
				alt="Portrait of Theo Urban"
				width="640"
				height="640"
				loading="eager"
				decoding="async"
			/>
			<figcaption>Profile image used on the main portfolio.</figcaption>
		</figure>
	</header>

	<nav class="toc" aria-label="On this page">
		<h2 class="toc-title">Contents</h2>
		<ol>
			<li><a href="#about">About</a></li>
			<li><a href="#projects">Projects and pages</a></li>
			<li><a href="#links">External links</a></li>
			<li><a href="#site">Human-facing pages</a></li>
		</ol>
	</nav>

	<section id="about" aria-labelledby="about-heading">
		<h2 id="about-heading">About</h2>
		<p>
			<strong>{content.name}</strong> is an AI major with math and LTI-related coursework at Carnegie Mellon
			University. They lead <strong>ScottyLabs</strong>, the software engineering club at CMU, and have served
			as a head teaching assistant for course 15-281. Interests include AI, computer science theory, mathematics,
			and how the open web can address real problems.
		</p>
	</section>

	<section id="projects" aria-labelledby="projects-heading">
		<h2 id="projects-heading">Projects and pages</h2>
		<p>
			The interactive portfolio reorganizes these entries per visit; this list is the canonical set of showcased
			work titles and topics.
		</p>
		<ul class="project-list">
			{#each content.pages as p (p.slug)}
				<li>
					<strong>{p.title}</strong>
					— tags: {p.tags.join(", ")} — slug <code>{p.slug}</code>
				</li>
			{/each}
		</ul>
	</section>

	<section id="links" aria-labelledby="links-heading">
		<h2 id="links-heading">External links</h2>
		<ul>
			{#each content.links as link (link.url)}
				<li>
					<a href={link.url}>{link.name}</a>
					<span class="muted"> — {link.url}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section id="site" aria-labelledby="site-heading">
		<h2 id="site-heading">Human-facing site entry points</h2>
		<ul>
			<li>
				<a href={`${origin}/${data.defaultSiteSlug}`}>Home portfolio</a> — `/` redirects to this slug; content is served from the database like other pages.
			</li>
			<li>
				<a href={`${origin}/new`}>Roll a new random theme</a> — invokes the Gemini style + UI pipeline (new slug).
			</li>
			<li>
				<a href={`${origin}/gallery`}>Gallery</a> — community thumbs-up on generated themes.
			</li>
		</ul>
	</section>

	<footer class="doc-footer">
		<p>
			Crawlers are redirected here from script-heavy routes for a readable HTML snapshot. Humans can use the
			links above for the full experience.
		</p>
	</footer>
</article>

<style>
	.doc {
		max-width: 44rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			Roboto,
			"Helvetica Neue",
			sans-serif;
		line-height: 1.6;
		color: #111;
		background: #fafafa;
		min-height: 100vh;
	}

	.doc-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid #e5e5e5;
		padding-bottom: 1.5rem;
	}

	.kicker {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #666;
		margin: 0 0 0.5rem;
	}

	h1 {
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		line-height: 1.15;
		margin: 0 0 0.75rem;
		font-weight: 700;
	}

	.lead {
		font-size: 1.1rem;
		color: #333;
		margin: 0 0 1.25rem;
		max-width: 42em;
	}

	.photo {
		margin: 1.25rem 0 0;
		max-width: 280px;
	}

	.photo img {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 8px;
		border: 1px solid #ddd;
	}

	.photo figcaption {
		font-size: 0.8rem;
		color: #666;
		margin-top: 0.5rem;
	}

	.toc {
		background: #fff;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		margin-bottom: 2rem;
	}

	.toc-title {
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.toc ol {
		margin: 0;
		padding-left: 1.25rem;
	}

	section {
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0 0 0.75rem;
		font-weight: 650;
	}

	.project-list,
	ul {
		padding-left: 1.25rem;
	}

	li {
		margin-bottom: 0.5rem;
	}

	.muted {
		color: #666;
		font-size: 0.9rem;
	}

	code {
		font-size: 0.88em;
		background: #eee;
		padding: 0.1em 0.35em;
		border-radius: 4px;
	}

	a {
		color: #0b57d0;
	}

	a:hover {
		text-decoration: underline;
	}

	.doc-footer {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e5e5;
		font-size: 0.9rem;
		color: #555;
	}
</style>
