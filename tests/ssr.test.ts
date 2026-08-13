import { expect, test } from "bun:test";
import { loadDistricts } from "../src/lib/districts";

const html = await Bun.file("dist/index.html").text();
/** What a crawler with no JavaScript, and a visitor whose script failed, see. */
const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/g, "");

test("every district in the allowlist renders server-side", async () => {
  const { districts } = await loadDistricts();
  expect(districts.length).toBeGreaterThan(0);
  for (const d of districts) expect(withoutScripts).toContain(d.id);
});

test("the summary and legend render server-side", () => {
  expect(withoutScripts).toMatch(/\d+ districts · \d+ alive · \d+ cold/);
  expect(withoutScripts).toContain("never a web service");
});

test("the honest line about silent districts is not script-dependent", () => {
  expect(withoutScripts).toContain("districts are not answering");
});

test("the tmux windows are real links, so back and indexing work", () => {
  expect(withoutScripts).toContain('href="/log"');
  expect(withoutScripts).toContain('href="/me"');
  expect(withoutScripts).toContain('aria-current="page"');
});

test("every district row is operable without typing", async () => {
  const { districts } = await loadDistricts();
  for (const d of districts) {
    expect(withoutScripts).toContain(`data-act="cd" data-id="${d.id}"`);
  }
});

test("the page paints its own ground rather than borrowing one", () => {
  expect(html).toMatch(/body\s*\{[^}]*background:\s*var\(--ground\)/);
  expect(html).toContain("--ground:#0b0d0c");
});

test("the unwritten tagline is marked unwritten rather than filled in", () => {
  expect(withoutScripts).toContain("tagline: yours to write");
});

test("no district is rendered alive unless the snapshot observed it", async () => {
  const { districts, health } = await loadDistricts();
  const alive = districts.filter((d) => d.status === "alive");
  for (const d of alive) {
    expect(health?.ok).toBe(true);
    expect(health?.entries[d.host as string]?.ok).toBe(true);
  }
});
