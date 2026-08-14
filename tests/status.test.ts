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
test("the reply reports what was actually observed, in words a visitor reads", () => {
  // the standard reason phrase is not an interpretation laid over the code —
  // 502 *is* bad gateway by definition. The raw number stays in the card and
  // in /health.json, so the row can be legible without being looser.
  expect(replyFor("cold", 502)).toBe("bad gateway");
  expect(replyFor("cold", 404)).toBe("not found");
  expect(replyFor("cold", 599)).toBe("599");
  expect(replyFor("alive", 200)).toBe("200 OK");
  expect(replyFor("alive", 204)).toBe("204 OK");
});

test("a code still never names a failure mode that was not observed", () => {
  // the original defect: every cold district printed "timeout", including one
  // answering 502. Only an actual 408/504 may say timeout.
  expect(replyFor("cold", 502)).not.toContain("timeout");
  expect(replyFor("cold", 503)).not.toContain("timeout");
  expect(replyFor("cold", 408)).toBe("timeout");
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

// health.json is machine-written and read with a bare JSON.parse cast. A file
// truncated to a valid object with no entries used to throw here, which takes
// the whole build down rather than rendering one district wrongly. The stated
// policy for an unreadable snapshot is that absence of observation resolves to
// unknown; a parseable one missing its entries is the same absence.
test("a snapshot with no entries at all is absence of observation, not a crash", () => {
  const broken = { ok: true, checkedAt: "2026-08-14T12:00:00.000Z" } as unknown as HealthSnapshot;

  expect(resolveStatus({ host: "aura.zae.life", visibility: "public" }, broken)).toBe("unknown");
});
