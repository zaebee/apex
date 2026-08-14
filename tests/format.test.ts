import { expect, test } from "bun:test";
import type { District } from "../src/lib/districts";
import {
  districtCells,
  districtRow,
  districtSpoken,
  evidenceGroups,
  LEGEND,
  observedFor,
  pad,
  shortMonth,
  summaryLines,
} from "../src/lib/format";
import { type HealthSnapshot, MARK } from "../src/lib/status";

const d = (over: Partial<District> = {}): District => ({
  id: "aura",
  title: "aura",
  host: "aura.zae.life",
  repo: "zaebee/aura",
  what: "Agent negotiation infrastructure",
  why: null,
  learned: null,
  status: "alive",
  code: 200,
  observed: null,
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

test("the cells the html map colours concatenate to exactly the text row", () => {
  for (const narrow of [false, true]) {
    const c = districtCells(d(), { narrow });
    expect(c.mark + c.id + c.host + c.reply + c.stats + c.last).toBe(districtRow(d(), { narrow }));
  }
});

test("a district without stats shows a dash rather than zeroes", () => {
  const row = districtRow(d({ stats: null, repo: null, status: "cold", code: null }));
  expect(row).toContain("—");
  expect(row).not.toContain("0c / 0d");
});

test("a row reports what was observed, never a label for the status", () => {
  expect(districtRow(d({ status: "cold", code: 502 }))).toContain("bad gateway");
  expect(districtRow(d({ status: "cold", code: 502 }))).not.toContain("timeout");
  expect(districtRow(d({ status: "cold", code: null }))).toContain("no answer");
});

test("the legend names ? only when a district actually holds it", () => {
  const known = summaryLines([d()], snap(), NOW);
  expect(known[2]).not.toContain("not observed");

  const unknown = summaryLines([d({ status: "unknown" })], snap({ ok: false }), NOW);
  expect(unknown[2]).toContain("? not observed");
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

// --- what the record supports, said as narrowly as it is true ---

const watched = (over: Partial<NonNullable<District["observed"]>> = {}) => ({
  state: "cold" as const,
  since: "2026-08-01T09:00:00.000Z",
  checks: 47,
  gaps: 0,
  ...over,
});

test("a single observation claims nothing beyond the status column", () => {
  expect(observedFor(d({ observed: watched({ checks: 1 }) }))).toBeNull();
  expect(observedFor(d({ observed: null }))).toBeNull();
});

test("the line names the checks, not a date nobody watched", () => {
  const line = observedFor(d({ status: "cold", observed: watched() }));
  expect(line).toBe("no answer in 47 checks since 1 Aug");
  // chat last committed in sep'25; the site began watching in August. The line
  // must not borrow the commit date and call it the start of the silence.
  expect(line).not.toContain("25");
});

test("holes in the streak are counted, not smoothed over", () => {
  expect(observedFor(d({ observed: watched({ gaps: 2 }) }))).toContain("2 gaps");
  expect(observedFor(d({ observed: watched({ gaps: 1 }) }))).toContain("1 gap");
  expect(observedFor(d({ observed: watched({ gaps: 0 }) }))).not.toContain("gap");
});

test("a living district reports its own streak", () => {
  expect(observedFor(d({ observed: watched({ state: "alive" }) }))).toContain("answering in 47");
});

// `since` is a UTC instant. Formatted in the runner's local zone it shifts a
// day on any negative offset, and the site would testify to 31 Jul for a check
// made on 1 Aug. The formatter pins the zone; this pins the formatter.
test("the rendered date does not move with the machine's timezone", () => {
  const line = observedFor(
    d({ status: "cold", observed: watched({ since: "2026-08-01T02:00:00.000Z" }) }),
    new Date("2026-08-20T00:00:00Z"),
  );
  expect(line).toContain("since 1 Aug");
});

test("a streak older than eleven months carries its year", () => {
  const line = observedFor(
    d({ status: "cold", observed: watched({ since: "2025-08-20T10:00:00.000Z" }) }),
    new Date("2026-09-20T00:00:00Z"),
  );
  expect(line).toContain("Aug 25");
});

// The row is padded columns, which a screen reader announces as
// "black circle, aura, aura dot zae dot life, 517c slash 41d, aug apostrophe 26".
// The padding is decoration that means something only to the eye.
test("a district has a spoken form that is a sentence, not a layout", () => {
  const spoken = districtSpoken(d());

  expect(spoken).toContain("aura.zae.life");
  expect(spoken).toContain("517 commits across 41 active days");
  expect(spoken).toContain("August 2026");
  // no column padding, and no glyph whose meaning the words already carry
  expect(spoken).not.toMatch(/ {2}/);
  expect(spoken).not.toContain(MARK.alive);
});

// The spoken form and the columns come from one District on purpose. If they
// are built separately they drift, and the site announces something it does not
// display — the private version of the defect it already guards against between
// the HTML map and the curl branch.
test("the spoken form and the columns describe the same district", () => {
  for (const district of [
    d(),
    d({ status: "cold", code: 502 }),
    d({ status: "offline", host: null, code: null, stats: null }),
    d({ status: "private", host: null, repo: null, what: null }),
    d({ status: "unknown", code: null }),
    d({ stats: { commits: 1, activeDays: 1, first: "2026-01-01", last: "2026-01-01" } }),
  ]) {
    const cells = districtCells(district);
    const spoken = districtSpoken(district);

    expect(spoken).toContain(district.id);
    expect(spoken).toContain(cells.reply.trim());
    if (district.host) expect(spoken).toContain(district.host);
    if (district.stats) expect(spoken).toContain(String(district.stats.commits));
    expect(spoken).not.toMatch(/ {2}/);
  }
});

// Asserted with what follows it: "1 active days" contains "1 active day", so a
// toContain on the singular passed against a version that always pluralised.
test("a district with one active day is not spoken of in the plural", () => {
  const one = districtSpoken(
    d({ stats: { commits: 1, activeDays: 1, first: "2026-01-01", last: "2026-01-01" } }),
  );
  expect(one).toContain("1 commit across 1 active day,");
  expect(one).not.toContain("days");
  expect(one).not.toContain("commits");

  const many = districtSpoken(d());
  expect(many).toContain("517 commits across 41 active days,");
});

// The columns and the sentence must not name different months. They parsed the
// date two different ways: `shortMonth` reads the fields, `spokenMonth` used
// `Date.parse`, which rolls a non-calendar day into the next month. takeStats
// admits `2026-02-31` — its guard is a shape, not a calendar — and stats.json is
// machine-written, which the loader's own comment says is not to be trusted.
test("the columns and the spoken form never name different months", () => {
  for (const last of ["2026-02-31", "2026-08-13", "2026-12-31", "2026-01-01"]) {
    const district = d({ stats: { commits: 5, activeDays: 2, first: "2026-01-01", last } });
    const column = districtCells(district).last.trim();
    const spoken = districtSpoken(district);
    if (column === "—") continue;
    // "feb'26" and "February 2026" have to agree about February
    const month = column.slice(0, 3);
    expect(spoken.toLowerCase()).toContain(month.toLowerCase());
  }
});

test("a date outside the calendar is reported, not silently moved", () => {
  const spoken = districtSpoken(
    d({ stats: { commits: 5, activeDays: 2, first: "2026-01-01", last: "2026-02-31" } }),
  );
  expect(spoken).toContain("February 2026");
  expect(spoken).not.toContain("March");
});

test("a month outside 1-12 is dropped from both tellings, not guessed", () => {
  const district = d({
    stats: { commits: 5, activeDays: 2, first: "2026-01-01", last: "2026-13-01" },
  });
  expect(districtCells(district).last.trim()).toBe("—");
  expect(districtSpoken(district)).not.toContain("last ");
});

// `what` is the author's prose and often ends in a full stop; appending another
// produced "Held the apex until now..", which is read as two pauses.
test("a second line that already ends in a stop does not get another", () => {
  expect(districtSpoken(d({ what: "A Telegram WebApp game. Held the apex until now." }))).toEndWith(
    "Held the apex until now.",
  );
  expect(districtSpoken(d({ what: "Agent negotiation infrastructure" }))).toEndWith(
    "Agent negotiation infrastructure.",
  );
  // a stop can sit inside a closing quote or bracket
  expect(districtSpoken(d({ what: 'He said "done."' }))).toEndWith('He said "done."');
  expect(districtSpoken(d({ what: "Ships (finally!)" }))).toEndWith("Ships (finally!)");
  // and a closing bracket with no stop before it still needs one
  expect(districtSpoken(d({ what: "A thing (mostly)" }))).toEndWith("A thing (mostly).");
});

test("the second line is spoken too, as its own sentence", () => {
  const watched = districtSpoken(
    d({
      status: "cold",
      code: 502,
      observed: { state: "cold", since: "2026-08-13T00:00:00.000Z", checks: 5, gaps: 0 },
    }),
    new Date("2026-08-14T12:00:00.000Z"),
  );
  expect(watched).toContain("no answer in 5 checks");
});

// The site keeps four kinds of knowledge apart internally and shows them to a
// visitor as one flat list in one voice. Each group names the file it came from
// and states freshness in its own vocabulary — or states none, where there is
// none to state.
test("each evidence group names its own file", () => {
  const groups = evidenceGroups(
    d(),
    "2026-08-14T12:00:00.000Z",
    new Date("2026-08-14T12:02:00.000Z"),
  );
  const byKind = Object.fromEntries(groups.map((g) => [g.kind, g.source]));

  expect(byKind.observed).toBe("health.json");
  expect(byKind.derived).toBe("stats.json");
  expect(byKind.authored).toBe("districts.toml");
});

// A probe's age erodes what it claims; git history's does not; authored prose
// has no freshness at all. Three headings over the same flat data would be the
// decorative version of this.
test("freshness is stated in each group's own vocabulary, or not at all", () => {
  const now = new Date("2026-08-14T12:02:00.000Z");
  const groups = evidenceGroups(
    d({
      stats: {
        commits: 517,
        activeDays: 41,
        first: "2026-01-24",
        last: "2026-08-13",
        readAt: "2026-08-11T12:00:00.000Z",
      },
    }),
    "2026-08-14T12:00:00.000Z",
    now,
  );
  const g = Object.fromEntries(groups.map((x) => [x.kind, x.freshness]));

  expect(g.observed).toBe("checked 2 min ago");
  expect(g.derived).toBe("read 3d ago");
  expect(g.authored).toBeNull();
});

// A heading over nothing claims something happened. A district with no host was
// never probed; a district with no repository has no commits to count.
test("a group with nothing in it is absent, not empty", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  const kinds = (x: District) => evidenceGroups(x, null, now).map((g) => g.kind);

  expect(kinds(d({ host: null, status: "offline" }))).not.toContain("observed");
  expect(kinds(d({ stats: null }))).not.toContain("derived");
  // authored always exists: the slots are the point, written or not
  expect(kinds(d({ what: null, why: null, learned: null, repo: null }))).toContain("authored");

  for (const g of evidenceGroups(d({ host: null, stats: null }), null, now)) {
    expect(g.lines.length).toBeGreaterThan(0);
  }
});

// It is folded from past probes and stored in its own file, so it is neither
// the current observation nor a reading of git. Labelling it health.json would
// be a false claim about provenance on a page about provenance.
test("the watched record names history.json, not the health snapshot", () => {
  const groups = evidenceGroups(
    d({
      status: "cold",
      code: 502,
      observed: { state: "cold", since: "2026-08-13T00:00:00.000Z", checks: 5, gaps: 0 },
    }),
    "2026-08-14T12:00:00.000Z",
    new Date("2026-08-14T12:00:00.000Z"),
  );
  const recorded = groups.find((g) => g.kind === "recorded");

  expect(recorded?.source).toBe("history.json");
  // its span is inside the sentence it makes; it has no separate freshness
  expect(recorded?.freshness).toBeNull();
  expect(recorded?.lines[0]?.value).toContain("5 checks");
});

// `??` treats "" as written while a truthiness check treats it as unwritten,
// which put an empty string in the colour reserved for a missing one.
test("an empty authored slot is unwritten, not written and blank", () => {
  const authored = evidenceGroups(d({ why: "" }), null, new Date()).find(
    (g) => g.kind === "authored",
  );
  const why = authored?.lines.find((l) => l.label === "why");

  expect(why?.unwritten).toBe(true);
  expect(why?.value).toBe("‹ not written yet ›");
});

test("unwritten authored slots are marked, not omitted", () => {
  const authored = evidenceGroups(d({ why: null, learned: null }), null, new Date()).find(
    (g) => g.kind === "authored",
  );
  const why = authored?.lines.find((l) => l.label === "why");

  expect(why).toBeDefined();
  expect(why?.unwritten).toBe(true);
});
