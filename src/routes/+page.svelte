<style>
  @import './page.css';
</style>
<script lang="ts">
  import '@fontsource/young-serif';
  import downarrow from '@/lib/assets/down_arrow.svg';
  import logo from '@/lib/assets/tu_logo.svg';
  import { browser } from '$app/environment';
  import githubLogo from '@/lib/assets/github.png';
  import linkedinLogo from '@/lib/assets/linkedin.png';
  import resumeIcon from '@/lib/assets/resume.svg';
  import emailIcon from '@/lib/assets/mail.svg';
  import stravaLogo from '@/lib/assets/strava.svg';
  import pages from '@/lib/assets/pages_info.json' with { type: 'json' };
  let sectionFilter = 'All';
  const setSectionFilter = (section: string) => {
    sectionFilter = section;
  };
  const images = import.meta.glob('@/lib/assets/pages/*', { eager: true });
  console.log(pages, images);
</script>

{#if browser}
  <script>
    const fadeElements = document.querySelectorAll('.fade-in-element');
    // make visible when scroll down 100px
    const handleScroll = () => {
      fadeElements.forEach((el) => {
        const rect = window.scrollY;
        console.log('scrolling', rect, screen.height, rect > screen.height - 100, el.classList);

        if (rect > screen.height - 100) {
          el.classList.remove('not-visible');
        } else {
          el.classList.add('not-visible');
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    // Initial check in case elements are already in view
    handleScroll();
  </script>
{/if}

<div style="height: 100vh; margin: 0;">
<img class="logo fade-in-element not-visible" src={logo} alt="logo" />
<div style="display: flex; justify-content: center; align-items: center;">
  <div class="introduction">
    <p class="small-text">Hi, I'm</p>
    <h1 class="big-name">Theo Urban</h1>
    <p class="small-text lower">...but if you're here, you probably already know that....</p>
  </div>
  <div class="about-arrow-container bounce2">
    <p class="about-text">About Me (scroll)</p>
    <img class="down-arrow" src={downarrow} alt="down arrow" />
  </div>

</div>
</div>

<div style="top: 100vh; height: 100vh; margin: 0;">
  <div class="about-me-initial">
    <div class="about-me-text">
      I’m an <span class="accented-text">AI</span> Major (with <span class="accented-text">Math & LTI minors</span>) @ <span class="accented-text">Carnegie Mellon</span>.  I run <span class="accented-text">ScottyLabs</span>, the premier Software Engineering Club at CMU, and am a Former <span class="accented-text">15-281 Head TA</span>.  I'm passionate about the power of the internet to solve problems, and endlessly intrigued by <span class="accented-text">AI, CS theory, math, and society</span>.
    </div>
    <div class="about-me-link-box">
      <a class="about-me-link-wrapper" href="https://github.com/tsurbs" target="_blank" aria-label="GitHub Profile"><img alt="GitHub Logo" src={githubLogo} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://www.linkedin.com/in/theo-urban-659a4b247/" target="_blank" aria-label="LinkedIn Profile"><img alt="LinkedIn Logo" src={linkedinLogo} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://resume.theourban.com" target="_blank" aria-label="Resume"><img alt="Resume Icon" src={resumeIcon} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="mailto:theo.s.urban@gmail.com" target="_blank" aria-label="Email"><img alt="Email Icon" src={emailIcon} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://www.strava.com/athletes/44903891" target="_blank" aria-label="Strava Profile"><img alt="Strava Logo" src={stravaLogo} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://resume.theourban.com" target="_blank" aria-label="Resume"><img alt="Resume Icon" src={resumeIcon} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://github.com/tsurbs" target="_blank" aria-label="GitHub Profile"><img alt="GitHub Logo" src={githubLogo} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://www.linkedin.com/in/theo-urban-659a4b247/" target="_blank" aria-label="LinkedIn Profile"><img alt="LinkedIn Logo" src={linkedinLogo} class="about-me-link" /></a>
      <a class="about-me-link-wrapper" href="https://resume.theourban.com" target="_blank" aria-label="Resume"><img alt="Resume Icon" src={resumeIcon} class="about-me-link" /></a>
    </div>
  </div>
  <div class="content-filter">
    <button class="section-header" class:bold={sectionFilter === 'All'} onclick={() => setSectionFilter('All')}>All</button> | <button class="section-header" class:bold={sectionFilter === 'AI'} onclick={() => setSectionFilter('AI')}>AI</button> | <button class="section-header" class:bold={sectionFilter === 'CS'} onclick={() => setSectionFilter('CS')}>CS</button> | <button class="section-header" class:bold={sectionFilter === 'Misc.'} onclick={() => setSectionFilter('Misc.')}>Misc.</button>
  </div>
  <div class="content-container">
    <!-- Content items would go here, filtered by sectionFilter -->
    {#each pages.filter(page => sectionFilter === 'All' || page.tags.includes(sectionFilter)) as page}
      <div class="content-item">
        <img src={`/src/lib/assets/${page.cover_image.replace("./", "")}`} alt={page.title} style="height:150px; aspect-ratio: 1 / 1; object-fit: contain; justify-self:center; border-radius: 10px;" /> <div class="vbar" ></div> <h2 style="justify-self: center; font-weight:400;">{page.title}</h2>
      </div>
    {/each}
  </div>

  </div>
