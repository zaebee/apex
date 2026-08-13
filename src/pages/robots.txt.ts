import type { APIRoute } from "astro";

// Open, AI crawlers included. Blocking them would sit oddly beside a site whose
// position is that machines are readers worth writing for.
export const GET: APIRoute = () =>
  new Response("User-agent: *\nAllow: /\n\nSitemap: https://zae.life/sitemap-index.xml\n", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
