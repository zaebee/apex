import { expect, test } from "bun:test";
import { type HealthSnapshot, MARK, REPLY, resolveStatus, TONE } from "../src/lib/status";

const snap = (
  entries: Record<string, { ok: boolean; code: number | null }>,
  ok = true,
): HealthSnapshot => ({
  checkedAt: "2026-08-13T10:00:00.000Z",
  ok,
  entries: Object.fromEntries(Object.entries(entries).map(([host, v]) => [host, { host, ...v }])),
});

test("a responding host is alive", () => {
  expect(
    resolveStatus({ host: "car.zae.life" }, snap({ "car.zae.life": { ok: true, code: 200 } })),
  ).toBe("alive");
});

test("a non-responding host is cold", () => {
  expect(
    resolveStatus({ host: "chat.zae.life" }, snap({ "chat.zae.life": { ok: false, code: null } })),
  ).toBe("cold");
});

test("a district with no host is offline, never cold", () => {
  expect(resolveStatus({}, snap({}))).toBe("offline");
});

test("a private district reports private even while responding", () => {
  expect(
    resolveStatus(
      { host: "infra.zae.life", visibility: "private" },
      snap({ "infra.zae.life": { ok: true, code: 200 } }),
    ),
  ).toBe("private");
});

// --- hard constraint 3: unverified is never green ---

test("a missing snapshot yields unknown, never alive", () => {
  expect(resolveStatus({ host: "car.zae.life" }, null)).toBe("unknown");
});

test("a failed snapshot yields unknown even for hosts it claims are ok", () => {
  expect(
    resolveStatus(
      { host: "car.zae.life" },
      snap({ "car.zae.life": { ok: true, code: 200 } }, false),
    ),
  ).toBe("unknown");
});

test("a host absent from the snapshot yields unknown, not cold", () => {
  expect(
    resolveStatus({ host: "new.zae.life" }, snap({ "car.zae.life": { ok: true, code: 200 } })),
  ).toBe("unknown");
});

test("no input combination can produce alive without a successful observation", () => {
  const inputs: Parameters<typeof resolveStatus>[0][] = [
    {},
    { host: "x.zae.life" },
    { host: "x.zae.life", visibility: "private" },
    { visibility: "public" },
  ];
  for (const i of inputs) {
    expect(resolveStatus(i, null)).not.toBe("alive");
    expect(resolveStatus(i, snap({}, false))).not.toBe("alive");
  }
});

test("amber is reserved for unknown and never spent on cold", () => {
  expect(TONE.unknown).toBe("warn");
  expect(TONE.cold).toBe("dim");
  expect(TONE.offline).toBe("dim");
  expect(TONE.alive).toBe("alive");
});

test("every status has a mark and a reply", () => {
  for (const s of ["alive", "cold", "offline", "private", "unknown"] as const) {
    expect(MARK[s].length).toBeGreaterThan(0);
    expect(REPLY[s].length).toBeGreaterThan(0);
  }
});
