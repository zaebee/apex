import type { District } from "./districts";
import type { Freshness } from "./freshness";
import { MARK, REPLY, type Status } from "./status";

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

export function districtRow(d: District, opts: { narrow?: boolean } = {}): string {
  const stats = d.stats ? `${d.stats.commits}c / ${d.stats.activeDays}d` : "—";

  return (
    `${MARK[d.status]}  ` +
    pad(d.id, 13) +
    (opts.narrow ? "" : pad(d.host ?? "—", 22)) +
    pad(REPLY[d.status], 11) +
    pad(stats, 11) +
    shortMonth(d.stats?.last ?? "")
  );
}

export function summaryLines(districts: District[], f: Freshness): string[] {
  const n = (s: Status) => districts.filter((d) => d.status === s).length;

  const counts = [
    `${districts.length} districts`,
    `${n("alive")} alive`,
    `${n("cold")} cold`,
    `${n("offline")} offline`,
  ];
  if (n("private")) counts.push(`${n("private")} private`);
  if (n("unknown")) counts.push(`${n("unknown")} unknown`);

  const age =
    f.label === "never"
      ? "health unknown — no successful check on record"
      : f.stale
        ? `snapshot · ${f.label} · stale`
        : `snapshot · ${f.label}`;

  return [counts.join(" · "), age, LEGEND];
}
