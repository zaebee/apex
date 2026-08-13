import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

// The description is the `attested` field, not the opening claim: what a reader
// most needs from a feed entry is what it does and does not support.
export const GET: APIRoute = async (context) => {
  const entries = (await getCollection("log")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "zae.life — attestations",
    description: "Claimed, observed, and what that does and does not support.",
    site: context.site ?? "https://zae.life",
    items: entries.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.attested,
      link: `/log/${e.id}/`,
    })),
  });
};
