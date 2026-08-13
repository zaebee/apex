import { expect, test } from "bun:test";
import {
  checkAnswer,
  extractFigures,
  extractQuotations,
  type Fragment,
  type Report,
  render,
} from "../src/lib/provenance";

// Indexing is checked rather than asserted away: if extraction returned nothing,
// the test that follows would otherwise pass vacuously on an undefined field.
function firstFragment(r: Report): Fragment {
  const f = r.quotations[0]?.fragments[0];
  if (!f) throw new Error("no fragment was extracted");
  return f;
}

const ARTICLE = `
An agent is built from four components. The model. A harness. Tools.
An environment. Users can choose which tools to enable, and can configure
permissions for each action Claude takes.
`;

test("quotations are found in every form a witness writes them", () => {
  const found = extractQuotations(
    [
      'He said "A harness" plainly.',
      "Then «An environment» in guillemets.",
      "And “Tools” in curly quotes.",
      "> The model",
    ].join("\n"),
  );
  expect(found.map((q) => q.raw)).toEqual(["A harness", "An environment", "Tools", "The model"]);
});

// A spliced quotation is two claims wearing one pair of quotation marks. Both
// halves can be real while the sentence they form is not, so each is checked
// on its own and reported on its own.
test("an ellipsis splits one quotation into separately checked fragments", () => {
  const q = extractQuotations('"An agent is built from four components... A harness"')[0];
  expect(q?.fragments).toEqual(["An agent is built from four components", "A harness"]);
});

test("case, whitespace and curly quotes do not decide a match", () => {
  const f = firstFragment(
    checkAnswer('"an   AGENT is built\nfrom four components"', { article: ARTICLE }),
  );
  expect(f.verdict).toBe("verbatim");
  expect(f.source).toBe("article");
});

test("a fragment absent from every source is reported as not found, not as false", () => {
  const r = checkAnswer('"Agents can get stuck in infinite loops"', { article: ARTICLE });
  const f = firstFragment(r);
  expect(f.verdict).toBe("not-found");
  expect(f.source).toBeNull();
  // the verdict is scoped to what was actually searched, so a reader can see
  // that absence here is absence from these files and nothing wider
  expect(r.searched).toEqual(["article"]);
});

// A short fragment matches almost any prose. Returning "verbatim" for it would
// be the tool inventing support, which is the failure it exists to surface.
test("a fragment too short to be evidence is not called verbatim", () => {
  expect(firstFragment(checkAnswer('"The model"', { article: ARTICLE })).verdict).toBe("too-short");
});

test("figures are surfaced with enough context to be checked by hand", () => {
  const figures = extractFigures("It routes work across 59 specialised agents, and 59 again.");
  expect(figures).toHaveLength(1);
  expect(figures[0]?.value).toBe("59");
  expect(figures[0]?.context).toContain("specialised agents");
});

// The tool reports; it does not conclude. Nothing it prints may read as a
// judgement about a witness, only as a list of things a reader must open the
// source to settle.
test("the report names what it searched and claims nothing beyond it", () => {
  const out = render(checkAnswer('"Agents can get stuck in infinite loops"', { article: ARTICLE }));
  expect(out).toContain("not found in: article");
  expect(out.toLowerCase()).not.toContain("false");
  expect(out.toLowerCase()).not.toContain("fabricat");
});
