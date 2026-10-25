// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow.
// Locally they default to the root so `npm run dev` just works.
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
