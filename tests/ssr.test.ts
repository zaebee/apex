import { expect, test } from "bun:test";
import { loadDistricts } from "../src/lib/districts";
import { districtRow } from "../src/lib/format";

/** Astro emits static output to dist/ with no server routes and to dist/client/
 *  once one exists (/api/ping). Resolved rather than hardcoded so adding or
 *  removing a function does not fail these tests in a way that reads as a
 *  rendering bug. */
async function builtPage(): Promise<string> {
  for (const p of ["dist/client/index.html", "dist/index.html"]) {
    const f = Bun.file(p);
    if (await f.exists()) return await f.text();
  }
  throw new Error("no built index.html — run `bun run build` first");
}

const html = await builtPage();
/** What a crawler with no JavaScript, and a visitor whose script failed, see. */
const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/g, "");

// Without this the assertions below would still pass on a page carrying no
// script at all, and "survives without JavaScript" would mean nothing.
test("the page does ship a script, so stripping it is a real test", () => {
  expect(html).toContain("<script");
  expect(withoutScripts.length).toBeLessThan(html.length);
});

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
  const re = /<summary[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/summary>/g;
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

function renderedCard(source: string, id: string): string {
  const m = new RegExp(`<details[^>]*\\sid="${id}"[\\s\\S]*?<\\/details>`).exec(source);
  return m ? decode(m[0].replace(/<[^>]*>/g, "")) : "";
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

// `cd <district>` is specified as opening the card. Built on <details>, so the
// card exists in the markup and opens by click and by keyboard with no script
// at all; the command layer toggles the same `open` property.
test("every district ships an openable card, not just a row", async () => {
  const { districts } = await loadDistricts();
  for (const d of districts) {
    const card = renderedCard(withoutScripts, d.id);
    expect(card).toContain("what");
    expect(card).toContain("why");
    expect(card).toContain("learned");
  }
});

test("a card names its unwritten prose rather than filling it", () => {
  // no district has why/learned written yet, and the page says so
  const card = renderedCard(withoutScripts, "aura");
  expect(card).toContain("not written yet");
});

// Named districts made this brittle: it asserted house had no statistics, which
// was true only while its private repository was unreadable. The moment a token
// existed the world changed and the test called it a regression. The invariant
// is the correspondence, not which district happens to be on which side of it.
test("a card shows the built line exactly when that district has statistics", async () => {
  const { districts } = await loadDistricts();
  expect(districts.length).toBeGreaterThan(0);

  for (const d of districts) {
    const card = renderedCard(withoutScripts, d.id);
    expect(card.includes("commits across")).toBe(Boolean(d.stats));
  }
});

test("the page paints its own ground rather than borrowing one", () => {
  expect(html).toMatch(/body\s*\{[^}]*background:\s*var\(--ground\)/);
  expect(html).toContain("--ground:#0b0d0c");
});

test("the unwritten tagline is marked unwritten rather than filled in", () => {
  expect(withoutScripts).toContain("tagline: yours to write");
});

// The dispatch handle must sit on the summary. With it on the <details>, every
// click inside the open card — prose, the outbound link, a text selection —
// resolved to a cd toggle and was preventDefault()ed, so the card fought the
// reader and its one link could never be followed.
test("the dispatch handle is on the summary, never on the card body", () => {
  const details = withoutScripts.match(/<details[^>]*>/g) ?? [];
  expect(details.length).toBeGreaterThan(0);
  for (const tag of details) expect(tag).not.toContain("data-act");

  const summaries = withoutScripts.match(/<summary[^>]*>/g) ?? [];
  expect(summaries.length).toBe(details.length);
  for (const tag of summaries) expect(tag).toContain('data-act="cd"');
});

test("the map lives outside the container clear empties", () => {
  // `clear` used to delete the server-rendered city, after which cd answered
  // "no district" about a district on the allowlist
  const streamStart = withoutScripts.indexOf('id="stream"');
  const outputStart = withoutScripts.indexOf('id="output"');
  const firstDistrict = withoutScripts.indexOf("<details");
  expect(streamStart).toBeGreaterThan(-1);
  expect(outputStart).toBeGreaterThan(streamStart);
  expect(firstDistrict).toBeGreaterThan(streamStart);
  expect(firstDistrict).toBeLessThan(outputStart);
});

test("the keyboard is never dropped into the invisible input", () => {
  expect(html).toMatch(/id="sink"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="sink"/);
});
