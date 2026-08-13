import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { RepoStats } from "../src/lib/districts";

export function computeStats(isoDates: string[]): RepoStats {
  if (isoDates.length === 0) return { commits: 0, activeDays: 0, first: "", last: "" };
  const sorted = [...isoDates].sort();
  return {
    commits: isoDates.length,
    activeDays: new Set(isoDates).size,
    first: sorted[0] ?? "",
    last: sorted[sorted.length - 1] ?? "",
  };
}

async function gitDates(dir: string): Promise<string[]> {
  const p = Bun.spawn(["git", "-C", dir, "log", "--format=%ad", "--date=short"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) throw new Error(`git log failed in ${dir}`);
  return out.split("\n").filter(Boolean);
}

export async function statsForRepo(dir: string): Promise<RepoStats> {
  return computeStats(await gitDates(dir));
}

/** Fetches full commit history without file contents. Code never materialises
 *  in CI; only metadata does. */
async function statsForRemote(repo: string, token: string): Promise<RepoStats> {
  const dir = await mkdtemp(join(tmpdir(), "apex-"));
  try {
    const url = `https://x-access-token:${token}@github.com/${repo}.git`;
    const p = Bun.spawn(["git", "clone", "--bare", "--filter=blob:none", "-q", url, dir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if ((await p.exited) !== 0) throw new Error(`clone failed for ${repo}`);
    return await statsForRepo(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const token = process.env.APEX_STATS_TOKEN;
  if (!token) throw new Error("APEX_STATS_TOKEN is required");

  const table = parseToml(await Bun.file("data/districts.toml").text()) as Record<
    string,
    { repo?: string }
  >;
  const repos = [
    ...new Set(
      Object.values(table)
        .map((s) => s.repo)
        .filter((r): r is string => !!r),
    ),
  ];

  // What the last successful run observed. Git history does not go stale the
  // way a health probe does: a commit count read last week is still a true
  // account of commits that happened, and the map prints the last-commit month
  // beside it. So a repo that fails to clone this time keeps its previous entry
  // rather than vanishing — dropping it would erase an observation that was
  // made, on the strength of a run that observed nothing about that repo.
  const previous: Record<string, RepoStats> = await Bun.file("data/stats.json")
    .json()
    .catch(() => ({}));

  const out: Record<string, RepoStats> = {};
  let read = 0;

  for (const repo of repos) {
    try {
      const stats = { ...(await statsForRemote(repo, token)), readAt: new Date().toISOString() };
      out[repo] = stats;
      read++;
      console.log(`ok     ${repo}  ${stats.commits}c / ${stats.activeDays}d`);
    } catch (e) {
      const kept = previous[repo];
      if (kept) {
        out[repo] = kept;
        console.error(`kept   ${repo}  unreadable this run: ${(e as Error).message}`);
      } else {
        // Never zero-filled: zeroes would testify to an empty history nobody
        // observed. With nothing previously observed either, it is omitted.
        console.error(`skip   ${repo}  ${(e as Error).message}`);
      }
    }
  }

  // Omitting a repo that failed is right; omitting all of them and writing the
  // empty result is not. A revoked token fails every clone, and writing {} would
  // erase every previously observed statistic on the strength of a run that
  // observed nothing. Keep the old testimony and fail loudly instead.
  if (repos.length > 0 && read === 0) {
    console.error(`refusing to write data/stats.json: 0/${repos.length} repos could be read`);
    process.exit(1);
  }

  await Bun.write("data/stats.json", `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `wrote data/stats.json — ${read}/${repos.length} read, ${Object.keys(out).length} recorded`,
  );
}
