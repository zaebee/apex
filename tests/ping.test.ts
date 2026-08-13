import { expect, test } from "bun:test";
import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot } from "../src/lib/probe";
import { resolveStatus } from "../src/lib/status";

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

test("the ping route opts out of prerendering, or it would ship a baked answer", async () => {
  const src = await Bun.file("src/pages/api/ping.ts").text();
  expect(src).toMatch(/export const prerender = false/);
});

test("the ping route forbids caching, or a cached probe would pose as live", async () => {
  const src = await Bun.file("src/pages/api/ping.ts").text();
  expect(src).toContain("no-store");
});
