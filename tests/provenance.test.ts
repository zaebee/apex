import { expect, test } from "bun:test";
import {
  checkAnswer,
  extractFigures,
  extractQuotations,
  type Fragment,
  type Report,
  render,
} from "../src/lib/provenance";

const ARTICLE = `An agent is built from four components. The model. A harness (instructions and guardrails). Tools.
An environment. Users can choose which tools to enable.
keeping humans in control
aligning with human values`;

// Indexing is checked rather than asserted away: if extraction returned nothing,
// the test that follows would otherwise pass vacuously on an undefined field.
function firstFragment(r: Report): Fragment {
  const f = r.quotations[0]?.fragments[0];
  if (!f) throw new Error("no fragment was extracted");
  return f;
}

function verdicts(answer: string): Fragment[] {
  return checkAnswer(answer, { article: ARTICLE }).quotations.flatMap((q) => q.fragments);
}

// Order is not asserted: which scan finds a quotation first is an implementation
// detail, and an earlier version of this test failed when the two loops were
// swapped even though the set was identical.
test("quotations are found in every form a witness writes them", () => {
  const found = extractQuotations(
    [
      'He said "A harness" plainly.',
      "Then «An environment» in guillemets.",
      "And “Tools” in curly quotes.",
      "Also 'a straight single' and ‘a curly single’.",
      "And „a low quote“ and 「a corner bracket」.",
      "> The model",
    ].join("\n"),
  );
  expect(found.map((q) => q.raw).sort()).toEqual(
    [
      "A harness",
      "An environment",
      "Tools",
      "a straight single",
      "a curly single",
      "a low quote",
      "a corner bracket",
      "The model",
    ].sort(),
  );
});

// A spliced quotation is two claims wearing one pair of quotation marks. Both
// halves can be real while the sentence they form is not, so each is checked
// on its own and reported on its own.
test("an ellipsis splits one quotation into separately checked fragments", () => {
  const q = extractQuotations('"An agent is built from four components... A harness"')[0];
  expect(q?.fragments).toEqual(["An agent is built from four components", "A harness"]);
});

test("case and whitespace do not decide a match", () => {
  const f = firstFragment(
    checkAnswer("«an   AGENT is built\nfrom four components»", { article: ARTICLE }),
  );
  expect(f.verdict).toBe("verbatim");
  expect(f.source).toBe("article");
});

// The surrounding marks are stripped by extraction, so a test that merely wraps
// its input in guillemets exercises none of the normalisation — an earlier pair
// of versions both missed this, and deleting the curly-quote rules left every
// test passing. What matters is curly marks *inside* the compared text, which is
// the ordinary case: sources use typographic apostrophes and witnesses retype
// them straight.
test("typographic marks inside the text do not decide a match", () => {
  const apostrophe = checkAnswer(`"Claude's own rate of checking in"`, {
    article: "On complex tasks, Claude’s own rate of checking in roughly doubles.",
  });
  expect(firstFragment(apostrophe).verdict).toBe("verbatim");

  const inner = checkAnswer(`«the "model" component matters»`, {
    article: "We think the “model” component matters most.",
  });
  expect(firstFragment(inner).verdict).toBe("verbatim");
});

// The opener rule alone leaves the closer unguarded: without it the first
// apostrophe inside a word ends the quotation, truncating what the witness
// actually quoted.
test("an apostrophe inside a word does not close a quotation", () => {
  expect(extractQuotations("He wrote 'don't stop believing' and left.").map((q) => q.raw)).toEqual([
    "don't stop believing",
  ]);
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

// One inches mark used to pair with the next real quotation, manufacturing the
// witness's own prose into a "quotation" reported as not found while the genuine
// quotation beside it vanished — an accusation and an erasure from one typo.
test("a stray same-character mark does not swallow the quotation after it", () => {
  const found = extractQuotations(
    'The screen measures 5" diagonally.\nThen: "Users can choose which tools to enable".',
  );
  expect(found.map((q) => q.raw)).toEqual(["Users can choose which tools to enable"]);
});

// An aside inside quotation marks is part of what the witness presented as
// quoted. Deleting it before checking, and then printing only the remainder,
// vouched for text the tool had not looked at.
test("a parenthetical inside the marks is checked, not deleted", () => {
  const [added] = verdicts('"Users can choose which tools to enable (and never misuse them)"');
  expect(added?.verdict).toBe("not-found");
  expect(added?.text).toContain("never misuse them");

  const [real] = verdicts('"A harness (instructions and guardrails)"');
  expect(real?.verdict).toBe("verbatim");
});

test("markdown emphasis around a quotation does not decide a match", () => {
  expect(verdicts("> **The model**. A harness (instructions and guardrails).")[0]?.verdict).toBe(
    "verbatim",
  );
});

// Collapsing whitespace across a source's line breaks would weld two list items
// into one "verbatim" quotation — the splice the ellipsis rule exists to catch,
// rewarded whenever the witness omits the ellipsis.
test("a line break in the source is a boundary a fragment cannot cross", () => {
  expect(verdicts('"keeping humans in control aligning with human values"')[0]?.verdict).toBe(
    "not-found",
  );
});

// Splitting on an ellipsis that belongs to the source leaves fragments too short
// to check, so a quotation that is verbatim in full would be unverifiable.
test("a quotation verbatim in full is checked whole before it is split", () => {
  const r = checkAnswer('"Four things… the model, a harness"', {
    a: "Four things… the model, a harness, tools.",
  });
  expect(r.quotations[0]?.fragments).toHaveLength(1);
  expect(firstFragment(r).verdict).toBe("verbatim");
});

test("a blockquote line is not checked twice when it contains an inline quotation", () => {
  expect(extractQuotations('> The witness wrote "The model" right here').map((q) => q.raw)).toEqual(
    ["The model"],
  );
});

test("figures are surfaced with context, and repeats keep their own", () => {
  const figures = extractFigures("It ran 87 tasks, and 87 percent of them passed.");
  expect(figures.map((f) => f.value)).toEqual(["87", "87"]);
  expect(figures[0]?.context).toContain("tasks");
  expect(figures[1]?.context).toContain("percent");
});

test("digits inside an identifier or a date are not offered as figures", () => {
  expect(extractFigures("Ed25519 signatures, dated 2026-08-13.")).toEqual([]);
  expect(extractFigures("routing across 59 agents").map((f) => f.value)).toEqual(["59"]);
});

// The tool reports; it does not conclude. The verdict line is compared whole:
// asserting merely that the output lacks the word "false" passed against a
// renderer that printed "the witness made this up".
test("the report's verdict vocabulary is fixed and says nothing about the witness", () => {
  const out = render(checkAnswer('"Agents can get stuck in infinite loops"', { article: ARTICLE }));
  const verdictLines = out.split("\n").filter((l) => /^ {4}\S/.test(l));
  expect(verdictLines).toEqual(["    not found in: article"]);
});
