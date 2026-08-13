import { expect, test } from "bun:test";
import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot, probe } from "../src/lib/probe";
import { resolveStatus } from "../src/lib/status";

const okFetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
const errFetch = (async () => new Response("", { status: 502 })) as unknown as typeof fetch;
const throwFetch = (async () => {
  throw new Error("ECONNREFUSED");
}) as unknown as typeof fetch;

test("a 200 is ok", async () => {
  expect((await probe("car.zae.life", okFetch)).ok).toBe(true);
});

test("a 502 is not ok but is still an observation", async () => {
  const e = await probe("car.zae.life", errFetch);
  expect(e.ok).toBe(false);
  expect(e.code).toBe(502);
});

test("a refused connection is not ok and carries no code", async () => {
  const e = await probe("chat.zae.life", throwFetch);
  expect(e.ok).toBe(false);
  expect(e.code).toBeNull();
});

test("a snapshot of successful probes is ok and carries every host", async () => {
  const s = await buildSnapshot(
    ["a.zae.life", "b.zae.life"],
    new Date("2026-08-13T10:00:00.000Z"),
    okFetch,
  );
  expect(s.ok).toBe(true);
  expect(Object.keys(s.entries).sort()).toEqual(["a.zae.life", "b.zae.life"]);
  expect(s.checkedAt).toBe("2026-08-13T10:00:00.000Z");
});

/** Answers for the control host, refuses for everything else — the shape of a
 *  working runner looking at a constellation that is genuinely down. */
const districtsDownFetch = (async (url: string | URL) => {
  if (String(url).includes("github.com")) return new Response("", { status: 200 });
  throw new Error("ECONNREFUSED");
}) as unknown as typeof fetch;

test("individual failures do not make the snapshot itself untrustworthy", async () => {
  const s = await buildSnapshot(["a.zae.life"], new Date(), districtsDownFetch);
  expect(s.ok).toBe(true);
  expect(s.entries["a.zae.life"]?.ok).toBe(false);
});

test("a check that could not reach even the control host carries no testimony", async () => {
  const s = await buildSnapshot(["a.zae.life"], new Date(), throwFetch);
  expect(s.ok).toBe(false);
  // and so every district resolves to unknown rather than to cold
  expect(resolveStatus({ host: "a.zae.life" }, s)).toBe("unknown");
});

test("the control host is never published as a district", async () => {
  const s = await buildSnapshot(["a.zae.life"], new Date(), okFetch);
  expect(Object.keys(s.entries)).toEqual(["a.zae.life"]);
});

test("a successful check records when it succeeded", async () => {
  const now = new Date("2026-08-13T10:00:00.000Z");
  const s = await buildSnapshot(["a.zae.life"], now, okFetch);
  expect(s.lastOkAt).toBe("2026-08-13T10:00:00.000Z");
});

test("a blind check carries forward the last time one succeeded", async () => {
  const previous = await buildSnapshot(
    ["a.zae.life"],
    new Date("2026-08-13T06:00:00.000Z"),
    okFetch,
  );
  const s = await buildSnapshot(["a.zae.life"], new Date("2026-08-13T10:00:00.000Z"), throwFetch, {
    previous,
  });
  expect(s.ok).toBe(false);
  expect(s.lastOkAt).toBe("2026-08-13T06:00:00.000Z");
});

test("an empty host list produces a snapshot that admits it observed nothing", async () => {
  const s = await buildSnapshot([], new Date(), okFetch);
  expect(s.ok).toBe(false);
  expect(Object.keys(s.entries)).toHaveLength(0);
});

test("hosts come from the allowlist, deduplicated, skipping stanzas with none", () => {
  const hosts = hostsFromToml(`
[a]
host = "a.zae.life"

[b]
host = "a.zae.life"

[c]
repo = "zaebee/c"
`);
  expect(hosts).toEqual(["a.zae.life"]);
});

test("the shipped allowlist yields the hosts the map will probe", async () => {
  const hosts = hostsFromToml(await Bun.file("data/districts.toml").text());
  expect(hosts).toContain("aura.zae.life");
  expect(hosts).not.toContain(undefined);
});

// --- #10: a hostname that now points elsewhere was not observed ---

/** A lapsed domain landing on a registrar's parking page: 200, and nothing to
 *  do with the district that used to be there. */
const parkedFetch = (async () => {
  const res = new Response("<html>buy this domain</html>", { status: 200 });
  Object.defineProperty(res, "url", { value: "https://parking.example.com/lander" });
  return res;
}) as unknown as typeof fetch;

const localeRedirectFetch = (async (url: string | URL) => {
  const res = new Response("", { status: 200 });
  Object.defineProperty(res, "url", { value: `${String(url).replace(/\/$/, "")}/en` });
  return res;
}) as unknown as typeof fetch;

const wwwFetch = (async (url: string | URL) => {
  const res = new Response("", { status: 200 });
  Object.defineProperty(res, "url", { value: String(url).replace("https://", "https://www.") });
  return res;
}) as unknown as typeof fetch;

test("a parked domain answering 200 is not reported alive", async () => {
  const e = await probe("lapsed.zae.life", parkedFetch);
  expect(e.ok).toBe(false);
  expect(e.redirectedTo).toBe("https://parking.example.com/lander");
});

test("and it resolves to unknown, not cold — nothing observed this district", async () => {
  const snap = await buildSnapshot(["lapsed.zae.life"], new Date(), parkedFetch);
  expect(resolveStatus({ host: "lapsed.zae.life" }, snap)).toBe("unknown");
});

test("a redirect within the same host is still the district answering", async () => {
  const e = await probe("estate.zae.life", localeRedirectFetch);
  expect(e.ok).toBe(true);
  expect(e.redirectedTo).toBeNull();
});

test("www and the bare host are the same site by convention", async () => {
  const e = await probe("estate.zae.life", wwwFetch);
  expect(e.ok).toBe(true);
  expect(e.redirectedTo).toBeNull();
});

test("where the probe landed is published either way", async () => {
  const snap = await buildSnapshot(["lapsed.zae.life"], new Date(), parkedFetch);
  // the record shows what was reached, so the judgment is checkable by a reader
  expect(snap.entries["lapsed.zae.life"]?.redirectedTo).toContain("parking.example.com");
});
