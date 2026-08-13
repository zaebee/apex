import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeStats, statsForRepo } from "../scripts/scan";

test("active days counts distinct dates, not commits", () => {
  const s = computeStats(["2026-08-12", "2026-08-12", "2026-08-12", "2026-08-13"]);
  expect(s.commits).toBe(4);
  expect(s.activeDays).toBe(2);
});

test("first and last are the extremes regardless of input order", () => {
  const s = computeStats(["2026-08-13", "2025-11-21", "2026-01-24"]);
  expect(s.first).toBe("2025-11-21");
  expect(s.last).toBe("2026-08-13");
});

test("an empty history yields zeroes rather than throwing", () => {
  const s = computeStats([]);
  expect(s).toEqual({ commits: 0, activeDays: 0, first: "", last: "" });
});

test("statsForRepo reads a real repository", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apex-scan-"));
  try {
    const run = async (args: string[], date?: string) => {
      const p = Bun.spawn(["git", "-C", dir, ...args], {
        stdout: "pipe",
        stderr: "pipe",
        env: date ? { ...process.env, GIT_COMMITTER_DATE: date } : process.env,
      });
      const code = await p.exited;
      if (code !== 0) throw new Error(`git ${args.join(" ")} exited ${code}`);
    };

    await run(["init", "-q"]);
    await run(["config", "user.email", "t@example.com"]);
    await run(["config", "user.name", "t"]);

    const commit = async (file: string, date: string) => {
      await Bun.write(join(dir, file), file);
      await run(["add", "-A"]);
      await run(["commit", "-q", "-m", file, "--date", date], date);
    };

    await commit("a.txt", "2026-08-12T10:00:00");
    await commit("b.txt", "2026-08-12T18:00:00");
    await commit("c.txt", "2026-08-13T09:00:00");

    const s = await statsForRepo(dir);
    expect(s.commits).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.first).toBe("2026-08-12");
    expect(s.last).toBe("2026-08-13");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("statsForRepo on a directory that is not a repository throws rather than reporting zero", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apex-empty-"));
  try {
    await expect(statsForRepo(dir)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
