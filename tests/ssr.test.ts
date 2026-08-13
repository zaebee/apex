import { expect, test } from "bun:test";
import { loadDistricts } from "../src/lib/districts";
import { districtRow } from "../src/lib/format";

const html = await Bun.file("dist/index.html").text();
/** What a crawler with no JavaScript, and a visitor whose script failed, see.
 *  Today the built page carries no script at all (the island is still empty),
 *  so this is a no-op — it starts discriminating once Task 9 ships the island. */
const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/g, "");

const decode = (s: string) =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

interface RenderedRow {
  id: string;
  html: string;
  text: string;
}

/** Rows straight out of the built page, so assertions run against what ships
 *  rather than against the library that produced it. */
function renderedRows(source: string): RenderedRow[] {
  const out: RenderedRow[] = [];
  const re = /<button[^>]*data-act="cd" data-id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
  let m = re.exec(source);
  while (m) {
    out.push({
      id: m[1] as string,
      html: m[2] as string,
      text: decode((m[2] as string).replace(/<[^>]*>/g, "")),
    });
    m = re.exec(source);
  }
  return out;
}

test("every district in the allowlist renders server-side", async () => {
  const { districts } = await loadDistricts();
  expect(districts.length).toBeGreaterThan(0);
  for (const d of districts) expect(withoutScripts).toContain(d.id);
});

test("the summary and legend render server-side", () => {
  expect(withoutScripts).toMatch(/\d+ districts · \d+ alive · \d+ cold/);
  expect(withoutScripts).toContain("never a web service");
});

test("the tmux windows are real links, so back and indexing work", () => {
  expect(withoutScripts).toContain('href="/log"');
  expect(withoutScripts).toContain('href="/me"');
  expect(withoutScripts).toContain('aria-current="page"');
});

test("every district row is present and operable without typing", async () => {
  const { districts } = await loadDistricts();
  const rows = renderedRows(withoutScripts);
  expect(rows.map((r) => r.id).sort()).toEqual(districts.map((d) => d.id).sort());
});

// Columns are held together by pad() inside districtCells, but the template
// emits them as separate expressions, so the alignment depends on the Astro
// compiler dropping whitespace-only text nodes. Nothing enforces the source
// formatting that keeps that true, and the compiler's policy is not pinned by
// the caret range on astro. This asserts the bytes rather than trusting either.
test("a rendered row is byte-identical to the shared text formatter", async () => {
  const { districts } = await loadDistricts();
  const rows = renderedRows(withoutScripts);
  expect(rows.length).toBeGreaterThan(0);

  for (const row of rows) {
    const d = districts.find((x) => x.id === row.id);
    expect(d).toBeDefined();
    if (!d) continue;
    // the continuation line, when present, is a second line inside the button
    const firstLine = row.text.split("\n")[0] as string;
    expect(firstLine).toBe(districtRow(d));
  }
});

// The map may not paint a district green unless the published snapshot observed
// it. Asserted against the emitted HTML: checking the library against itself
// would still pass if the template hardcoded the alive class on every mark.
test("no rendered district is green unless the snapshot observed it", async () => {
  const { health } = await loadDistricts();
  for (const row of renderedRows(withoutScripts)) {
    if (!/class="alive"/.test(row.html)) continue;
    expect(health?.ok).toBe(true);
    const observed = Object.values(health?.entries ?? {}).some((e) => e.ok === true);
    expect(observed).toBe(true);
  }
});

test("the page paints its own ground rather than borrowing one", () => {
  expect(html).toMatch(/body\s*\{[^}]*background:\s*var\(--ground\)/);
  expect(html).toContain("--ground:#0b0d0c");
});

test("the unwritten tagline is marked unwritten rather than filled in", () => {
  expect(withoutScripts).toContain("tagline: yours to write");
});

test("the keyboard is never dropped into the invisible input", () => {
  expect(html).toMatch(/id="sink"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="sink"/);
});
