import { expect, test } from "bun:test";
import type { District } from "../src/lib/districts";
import { districtRow, LEGEND, pad, shortMonth, summaryLines } from "../src/lib/format";
import { freshness } from "../src/lib/freshness";

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

test("the summary counts every status and carries the snapshot age", () => {
  const lines = summaryLines(
    [d(), d({ id: "chat", status: "cold" }), d({ id: "house", status: "offline" })],
    freshness("2026-08-13T09:54:00.000Z", new Date("2026-08-13T10:00:00.000Z")),
  );
  expect(lines[0]).toBe("3 districts · 1 alive · 1 cold · 1 offline");
  expect(lines[1]).toBe("snapshot · 6 min ago");
});

test("a stale snapshot says so on the summary line", () => {
  const lines = summaryLines(
    [d()],
    freshness("2026-08-13T06:00:00.000Z", new Date("2026-08-13T10:00:00.000Z")),
  );
  expect(lines[1]).toContain("stale");
});

test("a snapshot that never happened is named, not omitted", () => {
  const lines = summaryLines([d()], freshness(null, new Date()));
  expect(lines[1]).toContain("health unknown");
});

test("unknown districts are counted rather than folded into cold", () => {
  const lines = summaryLines([d({ status: "unknown" })], freshness(null, new Date()));
  expect(lines[0]).toContain("1 unknown");
});

test("the legend explains cold without a separate panel", () => {
  expect(LEGEND).toContain("answering now");
  expect(LEGEND).toContain("was deployed");
  expect(LEGEND).toContain("never a web service");
});
