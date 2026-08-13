import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot } from "../src/lib/probe";
import type { HealthSnapshot } from "../src/lib/status";

const OUT = "data/health.json";

const hosts = hostsFromToml(await Bun.file("data/districts.toml").text());

// read the previous snapshot so a failed run can still say when one last worked
const file = Bun.file(OUT);
const previous: HealthSnapshot | null = (await file.exists())
  ? ((await file.json()) as HealthSnapshot)
  : null;

const snapshot = await buildSnapshot(hosts, new Date(), fetch, { previous });
await Bun.write(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);

const alive = Object.values(snapshot.entries).filter((e) => e.ok).length;
console.log(
  snapshot.ok
    ? `wrote ${OUT} — ${alive}/${hosts.length} answering`
    : `wrote ${OUT} — check could not observe anything; recorded as unknown`,
);
