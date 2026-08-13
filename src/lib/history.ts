import type { HealthSnapshot } from "./status";

/** What a run can conclude about one host. Narrower than Status: only hosts get
 *  probed, so `offline` and `private` never appear here. */
export type ObservedState = "alive" | "cold" | "unknown";

export interface HostRecord {
  state: ObservedState;
  /** The first check that observed the *current* state. Never earlier — the
   *  site began observing on the day it went live, and a district that had been
   *  silent for a year before that was silent unobserved. Saying otherwise
   *  would testify to something nobody watched. */
  since: string;
  /** Checks that observed this state. The claim the record actually supports. */
  checks: number;
  /** Runs that could not observe at all. Counted rather than skipped: a streak
   *  with holes in it is a different claim from an unbroken one, and hiding the
   *  holes would make the count say more than it should. */
  gaps: number;
}

export interface History {
  updatedAt: string;
  hosts: Record<string, HostRecord>;
}

export const EMPTY_HISTORY: History = { updatedAt: "", hosts: {} };

/** Prior state arrives as JSON read off disk, so it is validated rather than
 *  trusted — the same discipline the snapshot gets. Anything malformed is
 *  discarded, which restarts that host's record at this observation instead of
 *  carrying a number nobody can account for. */
function takeRecord(raw: unknown, now: Date): HostRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const state = r.state;
  if (state !== "alive" && state !== "cold" && state !== "unknown") return null;

  const since = r.since;
  if (typeof since !== "string") return null;
  const t = Date.parse(since);
  if (Number.isNaN(t) || new Date(t).toISOString() !== since) return null;
  // A single run with a wrong clock would otherwise stamp a start date after
  // the checks it counts, and keep it — `since` only resets on a state change.
  if (t > now.getTime()) return null;

  // Counts of observations: whole, non-negative, finite. `typeof === "number"`
  // admits -5, 2.5 and Infinity — JSON carries 1e999 as Infinity, which would
  // render "in Infinity checks".
  const whole = (v: unknown): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (!whole(r.checks) || !whole(r.gaps)) return null;

  return { state, since, checks: r.checks, gaps: r.gaps };
}

function observe(entry: { ok: boolean; offSite?: boolean }): ObservedState {
  if (entry.offSite === true) return "unknown";
  if (entry.ok === true) return "alive";
  if (entry.ok === false) return "cold";
  return "unknown";
}

/** Folds one snapshot into the running record. Pure: the caller reads and
 *  writes the file, which keeps every rule above testable without a disk. */
export function updateHistory(previous: History, snapshot: HealthSnapshot, now: Date): History {
  const hosts: Record<string, HostRecord> = {};

  // carried forward, including hosts no longer on the allowlist: a record of
  // what was observed does not stop being true because the map moved on
  for (const [host, raw] of Object.entries(previous?.hosts ?? {})) {
    const kept = takeRecord(raw, now);
    if (kept) hosts[host] = kept;
  }

  const blind = snapshot.ok !== true;
  const seen = new Set(Object.keys(snapshot?.entries ?? {}));

  // A host carried forward but not in this snapshot — dropped from the
  // allowlist, or added back later — was not observed either. Without this a
  // record could resume after six months and still read "3 checks, no gaps":
  // an unbroken watch nobody kept.
  if (!blind) {
    for (const [host, rec] of Object.entries(hosts)) {
      if (!seen.has(host)) hosts[host] = { ...rec, gaps: rec.gaps + 1 };
    }
  }

  for (const [host, entry] of Object.entries(snapshot?.entries ?? {})) {
    const prior = hosts[host];

    if (blind) {
      // nothing was observed, so nothing is confirmed and nothing is broken;
      // a host with no record yet gets none, because a gap is not a first sight
      if (prior) hosts[host] = { ...prior, gaps: prior.gaps + 1 };
      continue;
    }

    const state = observe(entry);

    hosts[host] =
      prior && prior.state === state
        ? { ...prior, checks: prior.checks + 1 }
        : { state, since: now.toISOString(), checks: 1, gaps: 0 };
  }

  return { updatedAt: now.toISOString(), hosts };
}
