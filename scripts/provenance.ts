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

const sources: Record<string, string> = {};
for (const pair of pairs) {
  const at = pair.indexOf("=");
  if (at === -1) {
    console.error(`source must be given as <name>=<path>, got: ${pair}`);
    process.exit(2);
  }
  sources[pair.slice(0, at)] = await Bun.file(pair.slice(at + 1)).text();
}

console.log(render(checkAnswer(await Bun.file(answerPath).text(), sources)));
