import type { APIRoute } from "astro";
// Inlined at build time, not read at request time. This route runs as a
// serverless function whose working directory does not contain the repository,
// so a cwd-relative readFile compiles fine, passes every test run from the
// project root, works in `astro dev` — and then throws ENOENT on the first
// production request. The bundle must carry the allowlist, not a path to it.
import tomlText from "../../../data/districts.toml?raw";
import { hostsFromToml } from "../../lib/hosts";
import { buildSnapshot } from "../../lib/probe";

// The one route that is not prerendered. The spec defines `ping` as re-running
// the checks live, bypassing the snapshot, and that is only honest server-side:
// seventeen cross-origin probes from the browser would be blocked by CORS, and
// what got through would measure the visitor's network while being printed as
// the site's.
export const prerender = false;

const HOSTS = hostsFromToml(tomlText);

export const GET: APIRoute = async () => {
  const snapshot = await buildSnapshot(HOSTS, new Date());

  return new Response(`${JSON.stringify(snapshot, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // never cached: a cached live probe is a snapshot claiming to be live
      "cache-control": "no-store",
    },
  });
};
