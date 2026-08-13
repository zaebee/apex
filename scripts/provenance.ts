// Mechanical first pass over a witness answer that has named its sources.
//
//   bun run provenance <answer.md> <name>=<source.txt> [<name>=<source.txt> ...]
//
// Prints every quoted fragment with whether it appears in the files given, and
// every figure with its context. It settles nothing: a fragment that appears
// was quoted, which is not the same as the claim resting on it being so, and a
// fragment that does not appear is absent from these files and no wider.

import { checkAnswer, render } from "../src/lib/provenance";

const [answerPath, ...pairs] = process.argv.slice(2);

if (!answerPath || pairs.length === 0) {
  console.error("usage: bun run provenance <answer.md> <name>=<source.txt> [...]");
  process.exit(2);
}

async function read(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.error(`cannot read: ${path}`);
    process.exit(2);
  }
  return file.text();
}

const sources: Record<string, string> = {};
for (const pair of pairs) {
  const at = pair.indexOf("=");
  const name = at === -1 ? "" : pair.slice(0, at).trim();

  // An unnamed source made the report print "searched: nothing" while a file
  // had in fact been searched, and a repeated name silently searched only the
  // last file while implying both. Either way the report misstates what it did,
  // which is the one thing this tool may never do.
  if (at === -1 || name === "") {
    console.error(`source must be given as <name>=<path>, got: ${pair}`);
    process.exit(2);
  }
  if (name in sources) {
    console.error(`source name used twice: ${name}`);
    process.exit(2);
  }

  sources[name] = await read(pair.slice(at + 1));
}

console.log(render(checkAnswer(await read(answerPath), sources)));
