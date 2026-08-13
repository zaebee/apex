import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// The third field is the one that matters and the one no other journal has:
// every entry ends by naming the limit of its own testimony. Required, and
// non-trivially so — an entry that cannot fill it honestly is not ready, and
// the build should say so rather than publish a claim with no boundary.
const log = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/log" }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    claimed: z.string().min(1),
    observed: z.string().min(1),
    attested: z.string().min(1),
  }),
});

export const collections = { log };
