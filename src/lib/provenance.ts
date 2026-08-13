// A mechanical first pass over a witness answer that has been asked to name its
// sources. It extracts the things that can be checked without judgement —
// quoted fragments and figures — and says, for each, whether it appears in the
// files it was given.
//
// What it deliberately does not do: decide whether a claim is true. A statement
// can be sourced and wrong, or unsourced and right; on the run that prompted
// this file one witness disowned a table it had invented and, in the same
// answer, withdrew a claim that is so. The output is a worklist for a reader,
// never a verdict about a witness.
//
// Its blind spot is worth stating where it cannot be missed. On that same run,
// the single worst failure was a premise about the project that is false,
// offered under `Источник: zae.life` with `Цитата: N/A` in place of a
// quotation. This tool is silent there: it checks quotations, and a marked
// non-answer gives it nothing to check. It is strongest against a witness that
// supplies evidence and weakest against one that supplies none, which is the
// opposite of where the risk sits.
//
// One assumption a caller must know about: line breaks in a source file are
// treated as hard boundaries, so a fragment cannot be matched by welding two
// lines together. A source flattened to a single line before it is handed over
// loses that protection silently. Keep the source's line structure.

export type Verdict = "verbatim" | "not-found" | "too-short";

export interface Fragment {
  text: string;
  verdict: Verdict;
  /** which source it was found in, or null */
  source: string | null;
}

export interface Quotation {
  raw: string;
  /** an ellipsis joins two claims under one pair of marks; each is checked alone */
  fragments: string[];
}

export interface CheckedQuotation {
  raw: string;
  fragments: Fragment[];
}

export interface Figure {
  value: string;
  context: string;
}

export interface Report {
  /** the source names searched, so "not found" is scoped to them and no wider */
  searched: string[];
  quotations: CheckedQuotation[];
  figures: Figure[];
}

/**
 * Below this many characters a fragment matches ordinary prose by coincidence,
 * so a hit is not evidence of anything. Reported as too-short rather than
 * silently passed: the tool must not manufacture the support it exists to test.
 */
const MIN_FRAGMENT = 12;

/** Stands in for a source's line break so no needle can span one. */
const LINE_BREAK = "\u0000";

/** Marks whose closer differs from their opener, so nesting can be tracked. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["“", "”"],
  ["«", "»"],
  ["„", "“"],
  ["「", "」"],
  ["‘", "’"],
];

/**
 * Marks that open and close with the same character, where an apostrophe or an
 * inches sign is indistinguishable from a quotation mark except by what sits
 * beside it. One stray `5"` used to pair with the next real quotation, turning
 * a witness's own prose into a fabricated "quotation" reported as not found and
 * dropping the genuine quotation beside it — an accusation and an erasure from
 * a single typo.
 */
const SYMMETRIC = new Set(['"', "'"]);

// Emphasis markers count as boundaries: witnesses write citations as
// `**Цитата:** *"…"*`, and a rule that only admitted whitespace rejected every
// quotation in the answer this tool was built to check. An ellipsis after a
// closing mark counts too, for the same reason in the other direction.
const BEFORE_OPENER = /[\s([{:;,—–*_-]/;
const AFTER_CLOSER = /[\s.,;:!?)\]}—–*_…-]/;

/**
 * An apostrophe needs a stricter left boundary than a quotation mark, because
 * it doubles as a possessive marker. Admitting emphasis for both — added so
 * that `**Цитата:** *"…"*` would open — made `*witness*'s answer said 'x'`
 * open at the possessive, swallowing the real quotation and manufacturing one
 * out of the prose before it. The exact fault the emphasis rule was added to
 * repair, reintroduced by the repair, on a form witnesses write constantly.
 */
const BEFORE_APOSTROPHE = /[\s([{—–-]/;

interface Span {
  raw: string;
  start: number;
  end: number;
}

function opensHere(text: string, i: number, mark: string): boolean {
  if (i === 0) return true;
  const previous = text[i - 1];
  if (previous === undefined) return true;
  return (mark === "'" ? BEFORE_APOSTROPHE : BEFORE_OPENER).test(previous);
}

function closesHere(text: string, i: number): boolean {
  const next = text[i + 1];
  return next === undefined || AFTER_CLOSER.test(next);
}

/** Index of the closing mark for a pair whose two marks differ, or null. */
function pairedCloser(text: string, from: number, open: string, close: string): number | null {
  let depth = 1;

  for (let j = from + 1; j < text.length; j++) {
    const c = text[j];
    if (c === open && open !== close) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) return closesHere(text, j) ? j : null;
    }
  }

  return null;
}

/** Index of the closing mark for a mark that opens and closes alike, or null. */
function symmetricCloser(text: string, from: number, mark: string): number | null {
  for (let j = from + 1; j < text.length; j++) {
    if (text[j] === mark && closesHere(text, j)) return j;
  }

  return null;
}

function closerFor(text: string, i: number, mark: string): number | null {
  const pair = PAIRS.find(([open]) => open === mark);
  if (pair) return pairedCloser(text, i, pair[0], pair[1]);
  return SYMMETRIC.has(mark) ? symmetricCloser(text, i, mark) : null;
}

function inlineQuotations(text: string): Span[] {
  const out: Span[] = [];
  let i = 0;

  while (i < text.length) {
    const mark = text[i];
    const end = mark && opensHere(text, i, mark) ? closerFor(text, i, mark) : null;

    if (end === null) {
      i++;
      continue;
    }

    out.push({ raw: text.slice(i + 1, end), start: i, end });
    i = end + 1;
  }

  return out;
}

/**
 * Blockquotes are how a longer citation usually arrives. A blockquote line that
 * already yielded an inline quotation is skipped, so the line's framing prose
 * is not checked a second time as though the witness had quoted it.
 */
function blockquotes(text: string, consumed: Span[]): string[] {
  const out: string[] = [];
  let offset = 0;

  for (const raw of text.split("\n")) {
    // The carriage return is trimmed rather than matched: `.` never matches it
    // and `$` without the m flag demands end of string, so a CRLF file used to
    // lose every blockquote citation. Offsets stay on the untrimmed line.
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const body = /^\s*>\s?(.+)$/.exec(line)?.[1];
    if (body) {
      const start = offset + line.indexOf(body);
      const end = start + body.length;
      if (!consumed.some((s) => s.start < end && s.end >= start)) out.push(body);
    }
    offset += raw.length + 1;
  }

  return out;
}

/**
 * Applied to both sides, so a witness quoting the article through markdown
 * emphasis is not reported as having quoted something absent.
 */
function shared(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\*\*|__|[*_`]/g, "")
    .toLowerCase();
}

function asNeedle(s: string): string {
  return shared(s).replace(/\s+/g, " ").trim();
}

function asHaystack(s: string): string {
  return shared(s)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r?\n/g, LINE_BREAK);
}

/** An ellipsis joins two claims under one pair of marks. */
function splice(raw: string): string[] {
  return raw
    .split(/…|\.\.\./)
    .map((f) => f.trim().replace(/^[,;:]+|[,;:]+$/g, ""))
    .filter((f) => f.length > 0);
}

export function extractQuotations(text: string): Quotation[] {
  const inline = inlineQuotations(text);
  const raws = [...inline.map((s) => s.raw), ...blockquotes(text, inline)];

  return raws
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => ({ raw, fragments: splice(raw) }));
}

/**
 * A number that numbers a heading or a list item is not a figure anyone needs
 * to settle. On the answer this tool was written for, every single figure it
 * reported was one of those: six section numbers and the two ends of a range.
 */
function isOrdinal(text: string, index: number, match: string): boolean {
  if (!match.endsWith(".") || !/^\d+\.$/.test(match)) return false;
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return /^[\s#*>-]*$/.test(text.slice(lineStart, index));
}

export function extractFigures(text: string): Figure[] {
  const out: Figure[] = [];
  // Not touching a word character, a hyphen or a dash, so `Ed25519` does not
  // become 25519, a date does not become three figures, and `уровни 1–3` does
  // not become the ends of its own range.
  const re = /(?<![\w.,—–-])\d[\d.,]*\s*%?(?![\w—–-])/g;

  for (const m of text.matchAll(re)) {
    const raw = m[0].trim();
    if (isOrdinal(text, m.index, raw)) continue;

    const from = Math.max(0, m.index - 40);
    const to = Math.min(text.length, m.index + m[0].length + 40);
    // Repeats are kept rather than deduplicated: the same number twice is two
    // claims in two contexts, and dropping the second discards the context a
    // reader would need to settle it.
    out.push({
      value: raw.replace(/[.,]$/, ""),
      context: text.slice(from, to).replace(/\s+/g, " ").trim(),
    });
  }

  return out;
}

function checkFragment(fragment: string, haystacks: Array<[string, string]>): Fragment {
  const needle = asNeedle(fragment);

  if (needle.length < MIN_FRAGMENT) {
    return { text: fragment, verdict: "too-short", source: null };
  }

  for (const [name, body] of haystacks) {
    if (body.includes(needle)) return { text: fragment, verdict: "verbatim", source: name };
  }

  return { text: fragment, verdict: "not-found", source: null };
}

/**
 * The whole quotation is checked first. A source containing an ellipsis of its
 * own would otherwise be unquotable: splitting on it leaves two fragments too
 * short to check, and a quotation that is verbatim in full would come back
 * unverifiable.
 */
function checkQuotation(raw: string, haystacks: Array<[string, string]>): Fragment[] {
  const whole = checkFragment(raw, haystacks);
  if (whole.verdict === "verbatim") return [whole];

  const parts = splice(raw);
  if (parts.length <= 1) return [whole];
  return parts.map((p) => checkFragment(p, haystacks));
}

export function checkAnswer(answer: string, sources: Record<string, string>): Report {
  const haystacks = Object.entries(sources).map(
    ([name, body]) => [name, asHaystack(body)] as [string, string],
  );

  const quotations = extractQuotations(answer).map((q) => ({
    raw: q.raw,
    fragments: checkQuotation(q.raw, haystacks),
  }));

  return { searched: Object.keys(sources), quotations, figures: extractFigures(answer) };
}

function oneLine(s: string, max = 72): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function verdictLine(f: Fragment, names: string): string {
  if (f.verdict === "verbatim") return `appears in: ${f.source}`;
  if (f.verdict === "too-short") return `too short to check (under ${MIN_FRAGMENT} characters)`;
  return `not found in: ${names}`;
}

export function render(report: Report): string {
  const names = report.searched.join(", ") || "nothing";
  const lines: string[] = [`searched: ${names}`, ""];

  for (const q of report.quotations) {
    for (const f of q.fragments) {
      lines.push(`  ${oneLine(f.text)}`, `    ${verdictLine(f, names)}`);
    }
  }

  if (report.figures.length > 0) {
    lines.push("", "figures, for a reader to settle by hand:");
    for (const fig of report.figures) lines.push(`  ${fig.value} — ${oneLine(fig.context)}`);
  }

  lines.push(
    "",
    "A fragment not found here is absent from the files searched. That is not a",
    "judgement about the statement, and a fragment that does appear is evidence",
    "only that it was quoted, not that the claim resting on it holds.",
  );

  return lines.join("\n");
}
