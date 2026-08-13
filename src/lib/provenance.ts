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
// the single worst failure was a premise invented about the project and offered
// with an empty citation field. This tool is silent there: it checks quotations,
// and nothing was quoted. It is strongest against a witness that supplies
// evidence and weakest against one that supplies none, which is the opposite of
// where the risk sits.

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

const CLOSERS: Record<string, string> = { '"': '"', "“": "”", "«": "»" };

function normalise(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Strip the notes witnesses leave inside quotation marks, e.g. "(суть статьи)". */
function stripAsides(s: string): string {
  return s.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim();
}

export function extractQuotations(text: string): Quotation[] {
  const raws: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const closer = ch ? CLOSERS[ch] : undefined;
    if (!closer) continue;
    const end = text.indexOf(closer, i + 1);
    if (end === -1) continue;
    raws.push(text.slice(i + 1, end));
    i = end;
  }

  // Markdown blockquotes carry the same weight as inline marks and are how a
  // longer citation usually arrives.
  for (const line of text.split("\n")) {
    const m = /^\s*>\s?(.+)$/.exec(line);
    const body = m?.[1];
    if (body) raws.push(body);
  }

  return raws
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => ({
      raw,
      fragments: raw
        .split(/…|\.\.\./)
        .map((f) => stripAsides(f.trim().replace(/^[,;:]+|[,;:]+$/g, "")))
        .filter((f) => f.length > 0),
    }));
}

export function extractFigures(text: string): Figure[] {
  const out: Figure[] = [];
  const seen = new Set<string>();
  const re = /\d[\d.,]*\s*%?/g;

  for (const m of text.matchAll(re)) {
    const value = m[0].trim().replace(/[.,]$/, "");
    if (seen.has(value)) continue;
    seen.add(value);
    const from = Math.max(0, m.index - 40);
    const to = Math.min(text.length, m.index + m[0].length + 40);
    out.push({ value, context: text.slice(from, to).replace(/\s+/g, " ").trim() });
  }

  return out;
}

function checkFragment(fragment: string, sources: Record<string, string>): Fragment {
  const needle = normalise(fragment);

  if (needle.length < MIN_FRAGMENT) {
    return { text: fragment, verdict: "too-short", source: null };
  }

  for (const [name, body] of Object.entries(sources)) {
    if (normalise(body).includes(needle)) {
      return { text: fragment, verdict: "verbatim", source: name };
    }
  }

  return { text: fragment, verdict: "not-found", source: null };
}

export function checkAnswer(answer: string, sources: Record<string, string>): Report {
  const quotations = extractQuotations(answer).map((q) => ({
    raw: q.raw,
    fragments: q.fragments.map((f) => checkFragment(f, sources)),
  }));

  return { searched: Object.keys(sources), quotations, figures: extractFigures(answer) };
}

function ellipsis(s: string, max = 72): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function render(report: Report): string {
  const lines: string[] = [];
  const names = report.searched.join(", ") || "nothing";

  lines.push(`searched: ${names}`);
  lines.push("");

  for (const q of report.quotations) {
    for (const f of q.fragments) {
      const mark =
        f.verdict === "verbatim"
          ? `appears in: ${f.source}`
          : f.verdict === "too-short"
            ? `too short to check (under ${MIN_FRAGMENT} characters)`
            : `not found in: ${names}`;
      lines.push(`  ${ellipsis(f.text)}`);
      lines.push(`    ${mark}`);
    }
  }

  if (report.figures.length > 0) {
    lines.push("");
    lines.push("figures, for a reader to settle by hand:");
    for (const fig of report.figures) lines.push(`  ${fig.value} — ${ellipsis(fig.context)}`);
  }

  lines.push("");
  lines.push(
    "A fragment not found here is absent from the files searched. That is not a",
    "judgement about the statement, and a fragment that does appear is evidence",
    "only that it was quoted, not that the claim resting on it holds.",
  );

  return lines.join("\n");
}
