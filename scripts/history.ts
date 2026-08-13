import { EMPTY_HISTORY, type History, updateHistory } from "../src/lib/history";
import type { HealthSnapshot } from "../src/lib/status";

// Separate from the probe on purpose. Folding used to run inside health.ts, and
// an unreadable record aborted the whole step — which in CI aborts the job
// before the commit, so the fresh snapshot never landed either. The comment
// there claimed "health keeps working while the record waits"; it did not.
// Two scripts, two steps: the probe commits regardless, and a broken record
// reddens only its own step.
const HISTORY = "data/history.json";

const snapshot = (await Bun.file("data/health.json").json()) as HealthSnapshot;

const file = Bun.file(HISTORY);
let previous: History = EMPTY_HISTORY;

if (await file.exists()) {
  try {
    previous = (await file.json()) as History;
  } catch {
    // Refuse rather than start over: an unreadable record is not an empty one,
    // and overwriting would erase every observation ever made on the strength
    // of a run that could not read them. The file stays, the step goes red.
    console.error(`refusing to fold into an unreadable ${HISTORY} — the record is left intact`);
    process.exit(1);
  }
}

const history = updateHistory(previous, snapshot, new Date(snapshot.checkedAt));
await Bun.write(HISTORY, `${JSON.stringify(history, null, 2)}\n`);
console.log(`folded into ${HISTORY} — ${Object.keys(history.hosts).length} hosts on record`);
