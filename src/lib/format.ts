import type { District } from "./districts";
import { freshness } from "./freshness";
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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** `2026-08-13` reads as `aug'26`. An em dash where there is no date, because a
 *  district with no commits has no last commit to report. */
export function shortMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(iso);
  if (!m) return "—";
  const month = MONTHS[Number.parseInt(m[2] as string, 10) - 1];
  if (!month) return "—";
  return `${month}'${(m[1] as string).slice(2)}`;
}

/** Where a district can actually be visited: its deployment if it has one, its
 *  repository otherwise, and nothing when it has neither. Shared by the card and
 *  by llms.txt so the two cannot point somewhere different for the same place. */
export function districtLink(d: District): string | null {
  if (d.host) return `https://${d.host}`;
  if (d.repo) return `https://github.com/${d.repo}`;
  return null;
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** What the record supports, said as narrowly as it is true.
 *
 *  Not "silent since sep'25". `chat` last saw a commit in September 2025, but
 *  this site began watching on the day it went live; what it can testify to is
 *  the checks it made. Naming the number of observations, and the holes in
 *  them, is the difference between "it is down" and "I watched it be down".
 *
 *  Returns null below two checks: "no answer in 1 check" is the status column
 *  again, in more words. */
export function observedFor(d: District): string | null {
  const o = d.observed;
  if (!o || o.checks < 2) return null;

  const verb =
    o.state === "alive" ? "answering" : o.state === "cold" ? "no answer" : "not observed";
  const since = DAY_MONTH.format(new Date(o.since));
  const holes = o.gaps > 0 ? `, ${o.gaps} ${o.gaps === 1 ? "gap" : "gaps"}` : "";

  return `${verb} in ${o.checks} checks since ${since}${holes}`;
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
    reply: pad(replyFor(d.status, d.code), 11),
    stats: pad(d.stats ? `${d.stats.commits}c / ${d.stats.activeDays}d` : "—", 11),
    last: shortMonth(d.stats?.last ?? ""),
  };
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
