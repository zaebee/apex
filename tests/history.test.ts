import { expect, test } from "bun:test";
import { type History, updateHistory } from "../src/lib/history";
import type { HealthSnapshot } from "../src/lib/status";

const at = (iso: string) => new Date(iso);

const snap = (
  entries: Record<string, { ok: boolean; offSite?: boolean }>,
  ok = true,
): HealthSnapshot => ({
  checkedAt: "ignored",
  ok,
  entries: Object.fromEntries(
    Object.entries(entries).map(([host, v]) => [host, { host, code: null, ...v }]),
  ),
});

const empty: History = { updatedAt: "", hosts: {} };

test("a first observation starts the record at now, not earlier", () => {
  const h = updateHistory(empty, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:00:00Z"));
  expect(h.hosts["a.zae.life"]).toEqual({
    state: "cold",
    since: "2026-08-13T10:00:00.000Z",
    checks: 1,
    gaps: 0,
  });
});

test("an unchanged state accumulates checks and keeps its since", () => {
  let h = updateHistory(empty, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:00:00Z"));
  h = updateHistory(h, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:30:00Z"));
  h = updateHistory(h, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T11:00:00Z"));
  expect(h.hosts["a.zae.life"]?.checks).toBe(3);
  expect(h.hosts["a.zae.life"]?.since).toBe("2026-08-13T10:00:00.000Z");
});

test("a changed state restarts the record — since is when this state was first seen", () => {
  let h = updateHistory(empty, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:00:00Z"));
  h = updateHistory(h, snap({ "a.zae.life": { ok: true } }), at("2026-08-13T10:30:00Z"));
  expect(h.hosts["a.zae.life"]).toEqual({
    state: "alive",
    since: "2026-08-13T10:30:00.000Z",
    checks: 1,
    gaps: 0,
  });
});

// A run that observed nothing must not be counted as evidence for the state it
// did not observe, and must not be silently skipped either — the streak has a
// hole in it, and the record says so.
test("a blind run is a gap: it neither confirms the state nor breaks it", () => {
  let h = updateHistory(empty, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:00:00Z"));
  h = updateHistory(h, snap({ "a.zae.life": { ok: true } }, false), at("2026-08-13T10:30:00Z"));

  expect(h.hosts["a.zae.life"]?.state).toBe("cold");
  expect(h.hosts["a.zae.life"]?.checks).toBe(1);
  expect(h.hosts["a.zae.life"]?.gaps).toBe(1);
  expect(h.hosts["a.zae.life"]?.since).toBe("2026-08-13T10:00:00.000Z");
});

test("a blind run does not invent a record for a host never observed", () => {
  const h = updateHistory(
    empty,
    snap({ "a.zae.life": { ok: true } }, false),
    at("2026-08-13T10:00:00Z"),
  );
  expect(h.hosts["a.zae.life"]).toBeUndefined();
});

test("a host that redirects off-site is its own state, not cold", () => {
  const h = updateHistory(
    empty,
    snap({ "a.zae.life": { ok: false, offSite: true } }),
    at("2026-08-13T10:00:00Z"),
  );
  expect(h.hosts["a.zae.life"]?.state).toBe("unknown");
});

test("a host dropped from the allowlist keeps its record rather than being erased", () => {
  let h = updateHistory(empty, snap({ "a.zae.life": { ok: false } }), at("2026-08-13T10:00:00Z"));
  h = updateHistory(h, snap({ "b.zae.life": { ok: true } }), at("2026-08-13T10:30:00Z"));
  expect(h.hosts["a.zae.life"]?.checks).toBe(1);
  expect(h.hosts["b.zae.life"]?.checks).toBe(1);
});

test("corrupt prior state is discarded rather than carried", () => {
  const poisoned = JSON.parse(
    '{"updatedAt":"x","hosts":{"a.zae.life":{"state":"alive","since":"whenever","checks":"many","gaps":null}}}',
  );
  const h = updateHistory(
    poisoned,
    snap({ "a.zae.life": { ok: false } }),
    at("2026-08-13T10:00:00Z"),
  );
  expect(h.hosts["a.zae.life"]).toEqual({
    state: "cold",
    since: "2026-08-13T10:00:00.000Z",
    checks: 1,
    gaps: 0,
  });
});
