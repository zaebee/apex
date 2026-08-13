import { expect, test } from "bun:test";
import { type HealthSnapshot, MARK, replyFor, resolveStatus, TONE } from "../src/lib/status";

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

// The tests above all build snapshots through the typed `snap()` helper, so
// none of them ever hands resolveStatus a value outside the declared interface.
// health.json is machine-written JSON read back through a bare cast, so that is
// exactly where the interface stops being a guarantee. These parse real text.

test("a snapshot whose booleans arrived as strings is unknown, not alive", () => {
  const parsed = JSON.parse(
    '{"checkedAt":"2026-08-13T10:00:00.000Z","ok":"false","entries":{"car.zae.life":{"host":"car.zae.life","ok":"false","code":null}}}',
  );
  expect(resolveStatus({ host: "car.zae.life" }, parsed)).toBe("unknown");
});

test("a truthy non-boolean ok on an entry is unknown, not alive", () => {
  const parsed = JSON.parse(
    '{"checkedAt":"t","ok":true,"entries":{"x":{"host":"x","ok":"yes","code":200}}}',
  );
  expect(resolveStatus({ host: "x" }, parsed)).toBe("unknown");
});

test("an entry missing its ok field is unknown, not cold", () => {
  const parsed = JSON.parse('{"checkedAt":"t","ok":true,"entries":{"x":{}}}');
  expect(resolveStatus({ host: "x" }, parsed)).toBe("unknown");
});

test("a snapshot missing ok entirely is unknown", () => {
  const parsed = JSON.parse('{"checkedAt":"t","entries":{"x":{"host":"x","ok":true,"code":200}}}');
  expect(resolveStatus({ host: "x" }, parsed)).toBe("unknown");
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
    expect(replyFor(s, null).length).toBeGreaterThan(0);
  }
});

// A constant per status would testify past observation: a host that answered
// 502 did not time out, and printing "timeout" over it names a failure mode
// nobody saw.
test("the reply reports the code that was actually observed", () => {
  expect(replyFor("cold", 502)).toBe("502");
  expect(replyFor("cold", 404)).toBe("404");
  expect(replyFor("alive", 200)).toBe("200 OK");
  expect(replyFor("alive", 204)).toBe("204 OK");
});

test("no code means no claim about how it failed", () => {
  expect(replyFor("cold", null)).toBe("no answer");
  expect(replyFor("cold", null)).not.toContain("timeout");
});

test("statuses that were never probed never quote a code", () => {
  for (const s of ["offline", "private", "unknown"] as const) {
    expect(replyFor(s, 200)).toBe(replyFor(s, null));
    expect(replyFor(s, 200)).not.toContain("200");
  }
});
