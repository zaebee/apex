import { expect, test } from "bun:test";
import { freshness } from "../src/lib/freshness";

const now = new Date("2026-08-13T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

test("minutes are reported in minutes", () => {
  expect(freshness(ago(6 * 60_000), now).label).toBe("6 min ago");
});

test("hours are reported in hours", () => {
  expect(freshness(ago(4 * 3_600_000), now).label).toBe("4h ago");
});

test("days are reported in days", () => {
  expect(freshness(ago(3 * 86_400_000), now).label).toBe("3d ago");
});

test("under a minute reads as just now", () => {
  expect(freshness(ago(20_000), now).label).toBe("just now");
});

test("a fresh snapshot is not stale", () => {
  expect(freshness(ago(30 * 60_000), now).stale).toBe(false);
});

test("a snapshot past the threshold is stale", () => {
  expect(freshness(ago(4 * 3_600_000), now).stale).toBe(true);
});

test("a missing timestamp is stale and says so", () => {
  const f = freshness(null, now);
  expect(f.stale).toBe(true);
  expect(f.label).toBe("never");
});

test("an unparseable timestamp is treated as no observation at all", () => {
  const f = freshness("not-a-date", now);
  expect(f.stale).toBe(true);
  expect(f.label).toBe("never");
});

test("a future timestamp is clamped rather than reported as negative", () => {
  const f = freshness(new Date(now.getTime() + 60_000).toISOString(), now);
  expect(f.ageMs).toBe(0);
  expect(f.label).toBe("just now");
});
