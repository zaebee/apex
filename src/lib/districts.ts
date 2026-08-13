import { readFile } from "node:fs/promises";
import { parse as parseToml } from "smol-toml";
import { EMPTY_HISTORY, type History, type HostRecord } from "./history";
import { type HealthSnapshot, resolveStatus, type Status } from "./status";

export interface RepoStats {
  commits: number;
  activeDays: number;
  first: string;
  last: string;
  /** When this history was read. Per repo rather than per file: a repo that
   *  failed to clone keeps the entry a previous run observed, and that entry
   *  must keep its own read time — a fresh stamp on a carried-forward number
   *  would claim an observation this run did not make. */
  readAt?: string | null;
}

export interface District {
  id: string;
  title: string;
  host: string | null;
  repo: string | null;
  what: string | null;
  why: string | null;
  learned: string | null;
  status: Status;
  /** How long this district has read the way it reads, and on how many
   *  observations. Absent until a check has seen it at least once. */
  observed: HostRecord | null;
  /** The HTTP code actually observed, when one was. Carried so the row can
   *  report what came back rather than a label chosen per status. */
  code: number | null;
  stats: RepoStats | null;
}

interface Stanza {
  repo?: string;
  host?: string;
  title?: string;
  what?: string;
  why?: string;
  learned?: string;
  visibility?: "public" | "private";
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Takes two numbers and two dates, and nothing else. The dates are shape-checked
 *  rather than merely type-checked: `first` and `last` are strings, and a string
 *  field copied verbatim out of a machine-written file is a channel through which
 *  automation could put text into the site's own testimony — /districts.json
 *  publishes this record verbatim. A value that is not a date was not a date
 *  anyone observed, so it becomes "", the same value computeStats uses for
 *  no-date-observed. This is where the ownership split is enforced, not by
 *  trusting the producer to behave. */
function takeStats(raw: unknown): RepoStats | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.commits !== "number" || typeof r.activeDays !== "number") return null;

  const date = (v: unknown): string => (typeof v === "string" && ISO_DATE.test(v) ? v : "");
  // Shape-checked like the dates, and for the same reason — but Date.parse is
  // not a shape check. It accepts "fresh as of 2026-08-13", and it reads
  // "maybe 2026" as May 2026, so prose from a machine-written file became a
  // confident "read 10h ago" on the card and shipped verbatim in
  // /districts.json. Only a value that round-trips through toISOString is the
  // instant it claims to be. A stamp in the future was not an observation.
  const stamp = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = Date.parse(v);
    if (Number.isNaN(t) || new Date(t).toISOString() !== v || t > Date.now()) return null;
    return v;
  };

  return {
    commits: r.commits,
    activeDays: r.activeDays,
    first: date(r.first),
    last: date(r.last),
    readAt: stamp(r.readAt),
  };
}

export function mergeDistricts(
  tomlText: string,
  stats: Record<string, RepoStats>,
  health: HealthSnapshot | null,
  history: History = EMPTY_HISTORY,
): District[] {
  const table = parseToml(tomlText) as Record<string, unknown>;

  return Object.entries(table).map(([id, raw]) => {
    // A top-level scalar — a stray `tagline = "..."` above the first stanza —
    // would otherwise become a district nobody declared. The allowlist is
    // authored by hand, so a malformed one is an author error worth failing the
    // build on rather than rendering as an entity.
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(
        `districts.toml: "${id}" is not a stanza. Every top-level entry must be a [table].`,
      );
    }
    const s = raw as Stanza;
    const repo = str(s.repo);
    const host = str(s.host);
    const status = resolveStatus({ host: host ?? undefined, visibility: s.visibility }, health);

    // Only carried when the snapshot itself is trustworthy and the code really
    // is a number — a code read off a failed check is not an observation.
    const observedCode = host && health?.ok === true ? health.entries[host]?.code : null;
    const code = typeof observedCode === "number" ? observedCode : null;

    return {
      id,
      title: str(s.title) ?? id,
      host,
      repo,
      what: str(s.what),
      why: str(s.why),
      learned: str(s.learned),
      status,
      code,
      observed: host ? (history.hosts?.[host] ?? null) : null,
      stats: repo ? takeStats(stats[repo]) : null,
    };
  });
}

/** Uses node:fs rather than the Bun globals because this runs inside the Astro
 *  build, which may execute in a Vite worker where `Bun` is not defined.
 *  Bun-specific APIs stay in `scripts/` and `tests/`, which bun runs directly. */
export async function loadDistricts(): Promise<{
  districts: District[];
  health: HealthSnapshot | null;
}> {
  const tomlText = await readFile("data/districts.toml", "utf8");

  const readJson = async <T>(path: string): Promise<T | null> => {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch {
      // A missing or unreadable file is absence of observation, not an error to
      // swallow into a default: callers resolve it to `unknown`.
      return null;
    }
  };

  const stats = (await readJson<Record<string, RepoStats>>("data/stats.json")) ?? {};
  const health = await readJson<HealthSnapshot>("data/health.json");
  const history = (await readJson<History>("data/history.json")) ?? EMPTY_HISTORY;

  return { districts: mergeDistricts(tomlText, stats, health, history), health };
}
