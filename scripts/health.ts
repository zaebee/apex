import { hostsFromToml } from "../src/lib/hosts";
import { buildSnapshot } from "../src/lib/probe";

const hosts = hostsFromToml(await Bun.file("data/districts.toml").text());
const snapshot = await buildSnapshot(hosts, new Date());
await Bun.write("data/health.json", `${JSON.stringify(snapshot, null, 2)}\n`);

const alive = Object.values(snapshot.entries).filter((e) => e.ok).length;
console.log(`wrote data/health.json — ${alive}/${hosts.length} answering`);
