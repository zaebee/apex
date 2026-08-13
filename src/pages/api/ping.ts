import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";
import { hostsFromToml } from "../../lib/hosts";
import { buildSnapshot } from "../../lib/probe";

// The one route that is not prerendered. The spec defines `ping` as re-running
// the checks live, bypassing the snapshot, and that is only honest server-side:
// seventeen cross-origin probes from the browser would be blocked by CORS, and
// what got through would measure the visitor's network while being printed as
// the site's.
export const prerender = false;

export const GET: APIRoute = async () => {
  const hosts = hostsFromToml(await readFile("data/districts.toml", "utf8"));
  const snapshot = await buildSnapshot(hosts, new Date());

  return new Response(`${JSON.stringify(snapshot, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // never cached: a cached live probe is a snapshot claiming to be live
      "cache-control": "no-store",
    },
  });
};
