import { readFile } from "node:fs/promises";
import { parse as parseToml } from "smol-toml";
import { type HealthSnapshot, resolveStatus, type Status } from "./status";

export interface RepoStats {
  commits: number;
  activeDays: number;
  first: string;
  last: string;
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

/** Reads only the four numeric fields. Anything else a stats file happens to
 *  carry is discarded here — this is where the ownership split is enforced,
 *  not by trusting the producer to behave. */
function takeStats(raw: unknown): RepoStats | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.commits !== "number" || typeof r.activeDays !== "number") return null;
  return {
    commits: r.commits,
    activeDays: r.activeDays,
    first: typeof r.first === "string" ? r.first : "",
    last: typeof r.last === "string" ? r.last : "",
  };
}

export function mergeDistricts(
  tomlText: string,
  stats: Record<string, RepoStats>,
  health: HealthSnapshot | null,
): District[] {
  const table = parseToml(tomlText) as Record<string, Stanza>;

  return Object.entries(table).map(([id, s]) => {
    const repo = str(s.repo);
    const host = str(s.host);
    return {
      id,
      title: str(s.title) ?? id,
      host,
      repo,
      what: str(s.what),
      why: str(s.why),
      learned: str(s.learned),
      status: resolveStatus({ host: host ?? undefined, visibility: s.visibility }, health),
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

  return { districts: mergeDistricts(tomlText, stats, health), health };
}
