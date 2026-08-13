import { EMPTY_HISTORY, type History, updateHistory } from "../src/lib/history";
import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot } from "../src/lib/probe";
import type { HealthSnapshot } from "../src/lib/status";

const OUT = "data/health.json";
const HISTORY = "data/history.json";

const hosts = hostsFromToml(await Bun.file("data/districts.toml").text());

// read the previous snapshot so a failed run can still say when one last worked
const file = Bun.file(OUT);
const previous: HealthSnapshot | null = (await file.exists())
  ? ((await file.json()) as HealthSnapshot)
  : null;

const now = new Date();
const snapshot = await buildSnapshot(hosts, now, fetch, { previous });
await Bun.write(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);

// The snapshot says what is true now; the history says how long it has been.
// Folded here rather than derived at build time, because Vercel builds from a
// shallow clone and has no git history to walk.
const historyFile = Bun.file(HISTORY);
const priorHistory: History = (await historyFile.exists())
  ? ((await historyFile.json()) as History)
  : EMPTY_HISTORY;
const history = updateHistory(priorHistory, snapshot, now);
await Bun.write(HISTORY, `${JSON.stringify(history, null, 2)}\n`);

const alive = Object.values(snapshot.entries).filter((e) => e.ok).length;
console.log(
  snapshot.ok
    ? `wrote ${OUT} — ${alive}/${hosts.length} answering`
    : `wrote ${OUT} — check could not observe anything; recorded as unknown`,
);
