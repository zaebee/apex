import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";

// The raw snapshot, timestamps and all. Prerendered, so this is the file the
// build read — not a fresh probe posing as one; /api/ping is where live goes.
export const GET: APIRoute = async () => {
  let body: string;
  try {
    body = await readFile("data/health.json", "utf8");
  } catch {
    // absence of a snapshot is absence of observation, reported as such
    body = `${JSON.stringify({ checkedAt: null, ok: false, lastOkAt: null, entries: {} }, null, 2)}\n`;
  }
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
};
