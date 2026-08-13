// @ts-check
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://zae.life",

  // Static by default. /api/ping opts out with `export const prerender = false`
  // in Task 9, because a live probe cannot be baked at build time — and probing
  // from the browser would measure the visitor's network rather than the site's.
  output: "static",
  adapter: vercel(),

  integrations: [sitemap()],

  // The stylesheet is a couple of KB; shipping it as a <link> would make the
  // first paint wait on a round trip for a page whose whole point is that it
  // has already answered before you arrived.
  build: { inlineStylesheets: "always" },
});
