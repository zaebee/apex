import type { District } from "./districts";
import { freshness } from "./freshness";
import type { ObservedState } from "./history";
import { type HealthEntry, type HealthSnapshot, MARK, replyFor, type Status } from "./status";

export const pad = (s: string, n: number): string =>
  s.length >= n ? s : s + " ".repeat(n - s.length);

/** `cold` is not a word a visitor knows. One grey line removes the guessing.
 *  The `?` and `▪` glyphs are appended only when a district actually holds that
 *  status — explaining a symbol that is not on the page is noise, and leaving
 *  one that is on the page unexplained is worse. */
const LEGEND_BASE = "● answering now    ○ was deployed, silent now    · never a web service";
export const LEGEND = LEGEND_BASE;

function legendFor(districts: District[]): string {
  const extra: string[] = [];
  if (districts.some((d) => d.status === "unknown")) extra.push("? not observed");
  if (districts.some((d) => d.status === "private")) extra.push("▪ private");
  return extra.length ? `${LEGEND_BASE}\n${extra.join("    ")}` : LEGEND_BASE;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** One parse, because the column and the spoken sentence are two tellings of
 *  the same date and must not disagree about it. They did: this read the fields
 *  while the spoken form used `Date.parse`, which rolls a non-calendar day into
 *  the next month — `2026-02-31` showed `feb'26` and said "March 2026". The
 *  guard in `takeStats` is a shape, `/^\d{4}-\d{2}-\d{2}$/`, not a calendar,
 *  and `stats.json` is machine-written. The same hazard is already documented
 *  for `readAt` in districts.ts; it came back here through a second parser.
 *
 *  A day that does not exist is reported under the month it was recorded in,
 *  not moved to the month it would land on. This tool reports; it does not
 *  correct its source. */
function monthOf(iso: string): { year: string; name: string } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(iso);
  const name = m ? MONTHS[Number.parseInt(m[2] as string, 10) - 1] : undefined;
  return m && name ? { year: m[1] as string, name } : null;
}

/** `2026-08-13` reads as `aug'26`. An em dash where there is no date, because a
 *  district with no commits has no last commit to report. */
export function shortMonth(iso: string): string {
  const m = monthOf(iso);
  return m ? `${m.name.slice(0, 3).toLowerCase()}'${m.year.slice(2)}` : "—";
}

/** Where a district can actually be visited: its deployment if it has one, its
 *  repository otherwise, and nothing when it has neither. Shared by the card and
 *  by llms.txt so the two cannot point somewhere different for the same place. */
export function districtLink(d: District): string | null {
  if (d.host) return `https://${d.host}`;
  if (d.repo) return `https://github.com/${d.repo}`;
  return null;
}

// timeZone is explicit: `since` is a UTC instant, and formatting it in the
// runner's local zone shifts the date a day on any negative offset — the site
// would testify to 31 Jul for a check made on 1 Aug.
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** The year appears once the streak is old enough that leaving it out would
 *  read as this year. Districts staying cold for years is this site's premise,
 *  so "since 20 Aug" on a thirteen-month silence would understate it as two
 *  weeks — a smaller claim than the truth, but still not the truth. */
function sinceLabel(since: string, now: Date): string {
  const d = new Date(since);
  const months = (now.getTime() - d.getTime()) / (30 * 86_400_000);
  return (months > 11 ? DAY_MONTH_YEAR : DAY_MONTH).format(d);
}

const OBSERVED_VERB: Record<ObservedState, string> = {
  alive: "answering",
  cold: "no answer",
  unknown: "not observed",
};

/** Present tense only when the current check saw it. Under a blind run the row
 *  says "unknown" in the status column, and a second line reading "answering"
 *  beneath it would assert something this run did not observe. */
const OBSERVED_VERB_PAST: Record<ObservedState, string> = {
  alive: "answered",
  cold: "no answer",
  unknown: "not observed",
};

function gapsClause(gaps: number): string {
  if (gaps <= 0) return "";
  return `, ${gaps} ${gaps === 1 ? "gap" : "gaps"}`;
}

/** What the record supports, said as narrowly as it is true.
 *
 *  Not "silent since sep'25". `chat` last saw a commit in September 2025, but
 *  this site began watching on the day it went live; what it can testify to is
 *  the checks it made. Naming the number of observations, and the holes in
 *  them, is the difference between "it is down" and "I watched it be down".
 *
 *  Returns null below two checks: "no answer in 1 check" is the status column
 *  again, in more words. */
export function observedFor(d: District, now: Date = new Date()): string | null {
  const o = d.observed;
  if (!o || o.checks < 2) return null;

  // the record describes what was seen; the current status decides whether it
  // may be spoken of in the present
  const current = d.status === o.state;
  const verb = current ? OBSERVED_VERB[o.state] : OBSERVED_VERB_PAST[o.state];

  return `${verb} in ${o.checks} checks since ${sinceLabel(o.since, now)}${gapsClause(o.gaps)}`;
}

/** The one second line a district gets, wherever it is rendered: a living
 *  district says what it is, a silent one says how long. The page and the
 *  plain-text branch call this, so they cannot testify differently about the
 *  same district — which they did when each decided for itself. */
export function secondLineFor(d: District, now: Date = new Date()): string | null {
  const watched = observedFor(d, now);
  return d.status === "alive" ? (d.what ?? watched) : watched;
}

export interface DistrictCells {
  mark: string;
  id: string;
  host: string;
  reply: string;
  stats: string;
  last: string;
}

/** The HTML map colours the mark and the reply, the plain-text branch does not.
 *  Both take their column widths from here, so the two renderings cannot drift
 *  into disagreeing about what the same district looks like. */
export function districtCells(d: District, opts: { narrow?: boolean } = {}): DistrictCells {
  return {
    mark: `${MARK[d.status]}  `,
    id: pad(d.id, 13),
    host: opts.narrow ? "" : pad(d.host ?? "—", 22),
    reply: pad(replyFor(d.status, d.code), 12),
    stats: pad(d.stats ? `${d.stats.commits}c / ${d.stats.activeDays}d` : "—", 11),
    last: shortMonth(d.stats?.last ?? ""),
  };
}

/** Ends a spoken sentence without doubling punctuation the author already
 *  wrote. The stop may sit inside a closing quote or bracket — `He said
 *  "done."` — which a check on the final character alone missed, producing the
 *  two pauses this exists to prevent. */
function stop(s: string): string {
  const t = s.trimEnd();
  return /[.!?…][)\]"»”'’]*$/.test(t) ? t : `${t}.`;
}

// Spoken dates are written out: `aug\'26` is a column that happens to fit, but
// read aloud it is "aug apostrophe 26". Same parse as the column, so the two
// tellings cannot name different months.
function spokenMonth(iso: string): string | null {
  const m = monthOf(iso);
  return m ? `${m.name} ${m.year}` : null;
}

/** The same district as `districtCells`, said rather than laid out.
 *
 *  Built here, beside the columns and from the one District, because the two
 *  must not drift: a hidden line generated somewhere else would let the page
 *  announce what it does not display — the private form of the disagreement
 *  the HTML map and the plain-text branch are already kept out of.
 *
 *  The status glyph is dropped. Its meaning is carried by the reply word, and
 *  reading both aloud says the same thing twice. The padding is dropped for the
 *  same reason it exists: it means something to the eye and nothing to an ear. */
export function districtSpoken(d: District, now: Date = new Date()): string {
  const parts = [d.id, d.host, replyFor(d.status, d.code)].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );

  if (d.stats) {
    const commits = `${d.stats.commits} commit${d.stats.commits === 1 ? "" : "s"}`;
    const days = `${d.stats.activeDays} active day${d.stats.activeDays === 1 ? "" : "s"}`;
    const last = spokenMonth(d.stats.last);
    const when = last ? `, last ${last}` : "";
    parts.push(`${commits} across ${days}${when}`);
  }

  // A second sentence, not a fourth clause: the row shows one line beneath the
  // columns, and speech keeps the same shape. `what` is the author's prose and
  // often ends in a full stop already — appending another produced "until now..",
  // which a screen reader pauses on twice.
  const second = secondLineFor(d, now);
  const sentence = `${parts.join(", ")}.`;
  return second ? `${sentence} ${stop(second)}` : sentence;
}

export interface EvidenceLine {
  label: string;
  value: string;
  /** an authored slot with nothing in it yet — a fact about the city, not a gap */
  unwritten?: boolean;
}

export interface EvidenceGroup {
  kind: "observed" | "recorded" | "derived" | "authored";
  /** the file it came from, named so the claim can be checked rather than trusted */
  source: string;
  /** stated in this group's own vocabulary, or absent where there is none */
  freshness: string | null;
  /** the stamp is missing rather than inapplicable — an absence worth flagging */
  unrecorded?: boolean;
  lines: EvidenceLine[];
}

/** What the probe alone saw, with no authored visibility folded in — which is
 *  the difference between this and `resolveStatus`. Off-site is `unknown`
 *  because something answered and it was not this district: an observation was
 *  made, and it was not of the thing being asked about. */
function statusOf(entry: HealthEntry): Status {
  if (entry.offSite === true) return "unknown";
  return entry.ok === true ? "alive" : "cold";
}

/** What the probe found, and only that.
 *
 *  Gated on the snapshot having observed *this host*, not merely on the district
 *  having one. A snapshot whose `ok` is false carries no testimony by its own
 *  definition, and an entry missing from a good snapshot is a host that run
 *  never reached — a district added to the allowlist between two health runs is
 *  exactly that. Either way the heading said `observed`, the byline said
 *  `health.json`, and the freshness said `checked 2 min ago` over a status that
 *  means nobody looked. A heading over nothing claims a check happened.
 *
 *  The reply is computed from the entry rather than from `d.status`, because
 *  `resolveStatus` returns `private` from authored visibility before it ever
 *  consults the snapshot. Reporting that here would put districts.toml's
 *  testimony under another file's byline, which is the one thing this grouping
 *  exists to prevent. The row still shows the resolved status; this shows what
 *  came back, and they are allowed to differ. */
function observedGroup(
  d: District,
  health: HealthSnapshot | null,
  now: Date,
): EvidenceGroup | null {
  if (!d.host || health?.ok !== true) return null;

  const entry = health.entries[d.host];
  if (!entry) return null;

  // A stamp in the future was not an observation. takeStats and takeRecord
  // already refuse one; freshness clamps the age to zero, so a year ahead read
  // as "just now" until this said otherwise.
  const stamped = Date.parse(health.checkedAt);
  if (Number.isNaN(stamped) || stamped > now.getTime()) return null;

  const reply = replyFor(statusOf(entry), entry.code);
  // the phrase and the number together: the row has room for one, the card for
  // both, and the number is the observation the phrase is a reading of
  const answered =
    entry.code === null || reply.includes(String(entry.code)) ? reply : `${reply} · ${entry.code}`;

  const lines: EvidenceLine[] = [
    { label: "host", value: d.host },
    { label: "answered", value: answered },
  ];
  // what was seen, kept beside what was concluded from it
  if (entry.finalUrl) lines.push({ label: "landed", value: entry.finalUrl });

  return {
    kind: "observed",
    source: "health.json",
    freshness: `checked ${freshness(health.checkedAt, now).label}`,
    lines,
  };
}

/** Folded from past probes and kept in its own file, so neither the current
 *  observation nor a reading of git. The span it covers is inside the sentence
 *  it makes; an age above it would be an age of an age. */
function recordedGroup(d: District, now: Date): EvidenceGroup | null {
  const watched = observedFor(d, now);
  if (!watched) return null;

  return {
    kind: "recorded",
    source: "history.json",
    freshness: null,
    lines: [{ label: "watched", value: watched }],
  };
}

/** Git history does not erode: a count read last week is still a true account of
 *  commits that happened, so this says `read` where the probe says `checked`. A
 *  missing stamp is flagged rather than left silent — three kinds of silence in
 *  one card are indistinguishable, and this one means the producer failed to say
 *  when it looked. */
function derivedGroup(d: District, now: Date): EvidenceGroup | null {
  if (!d.stats) return null;

  const unit = d.stats.activeDays === 1 ? "day" : "days";
  const read = freshness(d.stats.readAt ?? null, now);
  const unrecorded = read.label === "never";

  return {
    kind: "derived",
    source: "stats.json",
    freshness: unrecorded ? "read · not recorded" : `read ${read.label}`,
    ...(unrecorded ? { unrecorded: true } : {}),
    lines: [
      {
        label: "built",
        value: `${d.stats.commits} commits across ${d.stats.activeDays} active ${unit}, last ${d.stats.last}`,
      },
    ],
  };
}

/** Always present, and given no freshness: prose does not go stale. The empty
 *  slots are the point — a district with nothing written about it is reporting
 *  that, not hiding it. */
function authoredGroup(d: District): EvidenceGroup {
  const lines: EvidenceLine[] = [];
  if (d.repo) lines.push({ label: "repo", value: `github.com/${d.repo}` });

  for (const [label, value] of [
    ["what", d.what],
    ["why", d.why],
    ["learned", d.learned],
  ] as const) {
    // One check, not two that can disagree: `??` treats "" as written while the
    // flag treats it as unwritten, which put an empty string in the colour
    // reserved for a missing one.
    lines.push({
      label,
      value: value || "‹ not written yet ›",
      ...(value ? {} : { unwritten: true }),
    });
  }

  return { kind: "authored", source: "districts.toml", freshness: null, lines };
}

/** The card used to show one flat list in one voice: a 502 beside a commit count
 *  beside a hand-written sentence. The site keeps these apart internally and
 *  enforces it at the merge; this is that separation made visible.
 *
 *  Four groups, not the three the issue sketched. The watched record is folded
 *  from past probes and kept in its own file, so filing it under health.json
 *  would be a false claim about where it came from — on a page whose subject is
 *  where things came from. */
export function evidenceGroups(
  d: District,
  health: HealthSnapshot | null,
  now: Date = new Date(),
): EvidenceGroup[] {
  return [
    observedGroup(d, health, now),
    recordedGroup(d, now),
    derivedGroup(d, now),
    authoredGroup(d),
  ].filter((g): g is EvidenceGroup => g !== null);
}

export function districtRow(d: District, opts: { narrow?: boolean } = {}): string {
  const c = districtCells(d, opts);
  return c.mark + c.id + c.host + c.reply + c.stats + c.last;
}

/** Takes the snapshot, not only its age. Freshness alone cannot distinguish a
 *  check that worked from one that ran, failed, and stamped itself with the
 *  current time — and printing a confident "snapshot · just now" above rows that
 *  are all `?` would have the status line vouching for testimony that does not
 *  exist. */
export function summaryLines(
  districts: District[],
  health: HealthSnapshot | null,
  now: Date,
): string[] {
  const n = (s: Status) => districts.filter((d) => d.status === s).length;

  const counts = [
    `${districts.length} districts`,
    `${n("alive")} alive`,
    `${n("cold")} cold`,
    `${n("offline")} offline`,
  ];
  if (n("private")) counts.push(`${n("private")} private`);
  if (n("unknown")) counts.push(`${n("unknown")} unknown`);

  const f = freshness(health?.checkedAt ?? null, now);

  let age: string;
  if (health?.ok === true && f.label !== "never") {
    age = f.stale ? `snapshot · ${f.label} · stale` : `snapshot · ${f.label}`;
  } else {
    const last = freshness(health?.lastOkAt ?? null, now);
    age =
      last.label === "never"
        ? "health unknown — no successful check on record"
        : `health unknown — last successful check ${last.label}`;
  }

  return [counts.join(" · "), age, legendFor(districts)];
}

/** The width of the mark and id columns, so a continuation line can be indented
 *  under the district name without hardcoding a number that silently drifts if
 *  the column widths ever change. */
export function continuationIndent(d: District, opts: { narrow?: boolean } = {}): number {
  const c = districtCells(d, opts);
  return c.mark.length + c.id.length;
}
