import type { District } from "./districts";
import { freshness } from "./freshness";
import type { ObservedState } from "./history";
import { type HealthSnapshot, MARK, replyFor, type Status } from "./status";

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
    parts.push(`${commits} across ${days}${last ? `, last ${last}` : ""}`);
  }

  // A second sentence, not a fourth clause: the row shows one line beneath the
  // columns, and speech keeps the same shape. `what` is the author's prose and
  // often ends in a full stop already — appending another produced "until now..",
  // which a screen reader pauses on twice.
  const second = secondLineFor(d, now);
  const sentence = `${parts.join(", ")}.`;
  return second ? `${sentence} ${stop(second)}` : sentence;
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
