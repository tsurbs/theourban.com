/**
 * Builds instant-load portfolio HTML + meta for /default-landing-page (bundled fallback).
 * Not LLM output — deterministic SPA from content.json. Run after editing content.json:
 *   node scripts/render-default-landing-snapshot.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'src/lib/assets');
const content = JSON.parse(readFileSync(join(assetsDir, 'content.json'), 'utf8'));

const SLUG_ROUTE = 'default-landing-page';
const themeWords = 'default landing page';
const styleGuide = {
	primaryColor: '#e8eef6',
	secondaryColor: '#8b9eb5',
	backgroundColor: '#0d1117',
	accentColor: '#58a6ff',
	headingFont: 'Fraunces',
	bodyFont: 'Figtree',
	spacingScale: 'relaxed',
	designSystemTheme: 'Nocturnal editorial portfolio'
};

const escAttr = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escHtml = (s) =>
	String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

const gf = encodeURIComponent(styleGuide.headingFont);
const gfb = encodeURIComponent(styleGuide.bodyFont);

const pagesNav = content.pages.map((p) => `<a class="navlink" href="#${escAttr(p.slug)}">${escHtml(p.title)}</a>`).join('');

const sections = [
	`<section id="top" class="view active hero">
	<div class="hero-inner">
	  <img class="profile" src="${escAttr(content.profile_pic)}" alt="" width="220" height="220" decoding="async" />
	  <h1>${escHtml(content.name)}</h1>
	  <p class="headline">${escHtml(content.headline)}</p>
	  <div class="social">
	    ${content.links
				.map(
					(l) =>
						`<a href="${escAttr(l.url)}" target="_top" rel="noopener noreferrer">${escHtml(l.name)}</a>`
				)
				.join(' · ')}
	  </div>
	</div>
  </section>`
]
	.concat(
		content.pages.map(
			(p) => `
  <section id="${escAttr(p.slug)}" class="view proj">
    <div class="card">
      <div class="card-media-wrap"><img src="${escAttr(p.cover_image)}" alt="" class="thumb" decoding="async" /></div>
      <div class="card-body">
        <h2>${escHtml(p.title)}</h2>
        <p class="tags">${escHtml(p.tags.join(' · '))}</p>
        <div class="body-html">${p.content}</div>
      </div>
    </div>
  </section>`
		)
	)
	.join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(content.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=${gf}:wght@400;600;700&amp;family=${gfb}:wght@400;600;700&amp;display=swap" rel="stylesheet"/>
<style>
:root{
  --bg:${styleGuide.backgroundColor};
  --fg:${styleGuide.primaryColor};
  --muted:${styleGuide.secondaryColor};
  --accent:${styleGuide.accentColor};
}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 800px at 10% -20%,rgba(88,166,255,0.12),transparent),var(--bg);color:var(--fg);font-family:'${styleGuide.bodyFont}',system-ui,sans-serif;min-height:100vh;line-height:1.55;}
nav{display:flex;flex-wrap:wrap;gap:.5rem .9rem;padding:1rem 1.25rem;position:sticky;top:0;z-index:10;background:rgba(13,17,23,0.72);backdrop-filter:blur(12px);border-bottom:1px solid rgba(232,238,246,0.08)}
.navlink{font-size:.85rem;text-decoration:none;color:var(--muted);transition:color .2s;font-weight:500;padding:.25rem 0;border-bottom:2px solid transparent}
.navlink:hover,.navlink.on{color:var(--accent);border-bottom-color:rgba(88,166,255,0.55)}
.view{display:none;width:100%;max-width:52rem;margin:0 auto}
.view.active{display:block}
.hero{padding:2.75rem 1.25rem 3rem;max-width:48rem;margin:0 auto auto}
.hero-inner{text-align:center}
.profile{width:clamp(140px,32vw,200px);height:auto;border-radius:18px;border:1px solid rgba(232,238,246,0.12);box-shadow:0 20px 50px rgba(0,0,0,0.45)}
.hero h1{font-family:'${styleGuide.headingFont}',Georgia,serif;font-weight:600;font-size:clamp(1.8rem,4.5vw,2.65rem);letter-spacing:-.03em;margin:1.35rem 0 .75rem}
.headline{font-size:1.05rem;color:var(--muted);max-width:36em;margin:0 auto;text-align:left}
.social{margin-top:1.65rem;font-size:.93rem;line-height:1.7;color:var(--muted)}
.social a{color:var(--accent);text-decoration:none;font-weight:600}
.social a:hover{text-decoration:underline}
.proj{padding:2rem 1.25rem 3rem;margin:0 auto}
.card{border:1px solid rgba(232,238,246,0.1);border-radius:20px;overflow:hidden;background:rgba(232,238,246,0.03);backdrop-filter:blur(8px)}
.card-media-wrap{width:100%;aspect-ratio:16/10;background:rgba(0,0,0,0.25)}
.thumb{width:100%;height:100%;object-fit:cover;display:block}
.card-body{padding:1.35rem 1.35rem 1.6rem}
.card-body h2{font-family:'${styleGuide.headingFont}',Georgia,serif;font-size:clamp(1.35rem,3vw,1.75rem);margin:0 0 .5rem;letter-spacing:-.02em}
.tags{font-size:.85rem;color:var(--muted);margin:0 0 1rem}
.body-html{font-size:.95rem;color:var(--fg)}
.body-html :where(p:first-child){margin-top:0}
.body-html :where(p:last-child){margin-bottom:0}
</style>
</head>
<body>
<nav id="nav" aria-label="Sections">
  <a class="navlink on" href="#top">Home</a>
  ${pagesNav}
</nav>
${sections}
<script>
(()=>{
const views=[...document.querySelectorAll(".view")];
const links=[...document.querySelectorAll(".navlink")];

function ids(){return views.map((v)=>v.id)}

function route(){
  let key=(location.hash||"#top").slice(1)||"top";
  if(!ids().includes(key))key="top";
  views.forEach((v)=>v.classList.toggle("active",v.id===key));
  links.forEach((a)=>{
    const tgt=(a.getAttribute("href")||"").slice(1)||"top";
    a.classList.toggle("on",tgt===key);
  });
}

links.forEach((a)=>{
  a.addEventListener("click",(e)=>{
    e.preventDefault();
    const h=a.getAttribute("href")||"#top";
    if(location.hash===h)route();
    else location.hash=h;
  });
});

window.addEventListener("hashchange",route);
route();
})();
</script>
</body></html>`;

writeFileSync(
	join(assetsDir, 'default-landing-page.meta.json'),
	JSON.stringify({ slug: SLUG_ROUTE, themeWords, styleGuide }, null, 2),
	'utf8'
);
writeFileSync(join(assetsDir, 'default-landing-page.snapshot.html'), html.trimStart(), 'utf8');
console.error('written default-landing snapshot + meta');
