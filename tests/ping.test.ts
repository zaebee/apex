import { expect, test } from "bun:test";
import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot } from "../src/lib/probe";
import { resolveStatus } from "../src/lib/status";
import { GET } from "../src/pages/api/ping";

const toml = await Bun.file("data/districts.toml").text();
const okFetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
const blindFetch = (async () => {
  throw new Error("ECONNREFUSED");
}) as unknown as typeof fetch;

test("the live probe covers exactly the hosts the scheduled one covers", async () => {
  const hosts = hostsFromToml(toml);
  const snap = await buildSnapshot(hosts, new Date(), okFetch);
  expect(Object.keys(snap.entries).sort()).toEqual([...hosts].sort());
});

// The live path shares buildSnapshot with the workflow precisely so it cannot
// develop a more generous idea of what counts as answering.
test("a live probe that reached nothing reports unknown, not a city of cold districts", async () => {
  const hosts = hostsFromToml(toml);
  const snap = await buildSnapshot(hosts, new Date(), blindFetch);
  expect(snap.ok).toBe(false);
  for (const h of hosts) expect(resolveStatus({ host: h }, snap)).toBe("unknown");
});

// These two previously asserted on the source text of the route — that
// `export const prerender = false` and the string "no-store" appear in the
// file. That proves an intention was typed, not that anything happens. Both now
// assert on what was produced: the build artifact, and the response itself.

test("the route is not prerendered, so it cannot ship a baked answer", async () => {
  // a prerendered endpoint lands in the static output; a server one does not
  for (const p of ["dist/client/api/ping", "dist/client/api/ping.json", "dist/api/ping"]) {
    expect(await Bun.file(p).exists()).toBe(false);
  }
  expect(await Bun.file("dist/client/index.html").exists()).toBe(true);
});

test("the response forbids caching, or a cached probe would pose as live", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
  try {
    const res = await GET({} as Parameters<typeof GET>[0]);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
  } finally {
    globalThis.fetch = original;
  }
});

test("the response is a snapshot in the shape the island expects", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
  try {
    const res = await GET({} as Parameters<typeof GET>[0]);
    const snap = await res.json();
    expect(snap).toHaveProperty("checkedAt");
    expect(snap).toHaveProperty("ok");
    expect(Object.keys(snap.entries).sort()).toEqual(hostsFromToml(toml).sort());
  } finally {
    globalThis.fetch = original;
  }
});
