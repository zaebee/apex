import { expect, test } from "bun:test";
import type { District } from "../src/lib/districts";
import { districtRow, LEGEND, pad, shortMonth, summaryLines } from "../src/lib/format";
import type { HealthSnapshot } from "../src/lib/status";

const d = (over: Partial<District> = {}): District => ({
  id: "aura",
  title: "aura",
  host: "aura.zae.life",
  repo: "zaebee/aura",
  what: "Agent negotiation infrastructure",
  why: null,
  learned: null,
  status: "alive",
  stats: { commits: 517, activeDays: 41, first: "2026-01-24", last: "2026-08-13" },
  ...over,
});

test("pad never truncates", () => {
  expect(pad("abcdef", 3)).toBe("abcdef");
  expect(pad("ab", 4)).toBe("ab  ");
});

test("dates read as the map shows them", () => {
  expect(shortMonth("2026-08-13")).toBe("aug'26");
  expect(shortMonth("2025-11-21")).toBe("nov'25");
  expect(shortMonth("")).toBe("—");
  expect(shortMonth("nonsense")).toBe("—");
});

test("a wide row carries mark, id, host, reply and stats", () => {
  const row = districtRow(d());
  expect(row).toContain("●");
  expect(row).toContain("aura.zae.life");
  expect(row).toContain("200 OK");
  expect(row).toContain("517c / 41d");
  expect(row).toContain("aug'26");
});

test("a narrow row drops the host and fits a 375px screen", () => {
  const row = districtRow(d(), { narrow: true });
  expect(row).not.toContain("aura.zae.life");
  expect(row.length).toBeLessThanOrEqual(46);
});

test("a district without stats shows a dash rather than zeroes", () => {
  const row = districtRow(d({ stats: null, repo: null, status: "cold" }));
  expect(row).toContain("—");
  expect(row).not.toContain("0c / 0d");
});

const NOW = new Date("2026-08-13T10:00:00.000Z");
const snap = (over: Partial<HealthSnapshot> = {}): HealthSnapshot => ({
  checkedAt: "2026-08-13T09:54:00.000Z",
  ok: true,
  entries: {},
  ...over,
});

test("the summary counts every status and carries the snapshot age", () => {
  const lines = summaryLines(
    [d(), d({ id: "chat", status: "cold" }), d({ id: "house", status: "offline" })],
    snap(),
    NOW,
  );
  expect(lines[0]).toBe("3 districts · 1 alive · 1 cold · 1 offline");
  expect(lines[1]).toBe("snapshot · 6 min ago");
});

test("a stale snapshot says so on the summary line", () => {
  const lines = summaryLines([d()], snap({ checkedAt: "2026-08-13T06:00:00.000Z" }), NOW);
  expect(lines[1]).toContain("stale");
});

test("a snapshot that never happened is named, not omitted", () => {
  const lines = summaryLines([d()], null, NOW);
  expect(lines[1]).toContain("health unknown");
  expect(lines[1]).toContain("no successful check on record");
});

// a check can fail and still stamp itself with the current time; freshness alone
// would call that "just now" and vouch for testimony that does not exist
test("a failed but fresh check reads as unknown, never as a fresh snapshot", () => {
  const lines = summaryLines([d({ status: "unknown" })], snap({ ok: false, lastOkAt: null }), NOW);
  expect(lines[1]).toContain("health unknown");
  expect(lines[1]).not.toContain("snapshot · ");
});

test("a failed check reports how old the last successful one is", () => {
  const lines = summaryLines(
    [d({ status: "unknown" })],
    snap({ ok: false, lastOkAt: "2026-08-13T06:00:00.000Z" }),
    NOW,
  );
  expect(lines[1]).toBe("health unknown — last successful check 4h ago");
});

test("unknown districts are counted rather than folded into cold", () => {
  const lines = summaryLines([d({ status: "unknown" })], null, NOW);
  expect(lines[0]).toContain("1 unknown");
});

test("the legend explains cold without a separate panel", () => {
  expect(LEGEND).toContain("answering now");
  expect(LEGEND).toContain("was deployed");
  expect(LEGEND).toContain("never a web service");
});
