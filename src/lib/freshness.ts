export interface Freshness {
  ageMs: number;
  label: string;
  stale: boolean;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const NEVER: Freshness = { ageMs: Number.POSITIVE_INFINITY, label: "never", stale: true };

/** Evidence carries its own freshness. A status line without an age asks to be
 *  taken on trust, which is the one thing this site does not do. */
export function freshness(checkedAt: string | null, now: Date, staleAfterMs = 2 * HOUR): Freshness {
  if (!checkedAt) return NEVER;

  const parsed = Date.parse(checkedAt);
  if (Number.isNaN(parsed)) return NEVER;

  const ageMs = Math.max(0, now.getTime() - parsed);

  let label: string;
  if (ageMs < MINUTE) label = "just now";
  else if (ageMs < HOUR) label = `${Math.floor(ageMs / MINUTE)} min ago`;
  else if (ageMs < DAY) label = `${Math.floor(ageMs / HOUR)}h ago`;
  else label = `${Math.floor(ageMs / DAY)}d ago`;

  return { ageMs, label, stale: ageMs > staleAfterMs };
}
