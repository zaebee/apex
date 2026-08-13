import type { District } from "./districts";
import { freshness } from "./freshness";
import { type HealthSnapshot, MARK, REPLY, type Status } from "./status";

export const pad = (s: string, n: number): string =>
  s.length >= n ? s : s + " ".repeat(n - s.length);

/** `cold` is not a word a visitor knows. One grey line removes the guessing. */
export const LEGEND = "● answering now    ○ was deployed, silent now    · never a web service";

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
    reply: pad(REPLY[d.status], 11),
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

  return [counts.join(" · "), age, LEGEND];
}
