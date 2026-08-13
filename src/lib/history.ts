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
function takeRecord(raw: unknown): HostRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const state = r.state;
  if (state !== "alive" && state !== "cold" && state !== "unknown") return null;

  const since = r.since;
  if (typeof since !== "string") return null;
  const t = Date.parse(since);
  if (Number.isNaN(t) || new Date(t).toISOString() !== since) return null;

  if (typeof r.checks !== "number" || typeof r.gaps !== "number") return null;

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
    const kept = takeRecord(raw);
    if (kept) hosts[host] = kept;
  }

  const blind = snapshot.ok !== true;

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
