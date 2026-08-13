import { expect, test } from "bun:test";
import { TERMINAL_UA } from "../middleware";
import type { District } from "../src/lib/districts";
import { loadDistricts } from "../src/lib/districts";
import { MARK, replyFor } from "../src/lib/status";

const dist = "dist/client";
const read = async (p: string) => await Bun.file(`${dist}/${p}`).text();

test("districts.json publishes the evidence, not just the conclusion", async () => {
  const data = await Bun.file(`${dist}/districts.json`).json();
  expect(Array.isArray(data.districts)).toBe(true);
  expect(data.districts.length).toBeGreaterThan(0);
  expect(data.districts[0]).toHaveProperty("status");
  expect(data).toHaveProperty("checkedAt");
});

test("health.json carries the timestamps its age is judged by", async () => {
  const data = await Bun.file(`${dist}/health.json`).json();
  expect(data).toHaveProperty("checkedAt");
  expect(data).toHaveProperty("ok");
});

// The published record and the rendered page must agree, or publishing the
// record proves nothing. Checking only that each id appears is not that check:
// a map that painted every district green — including two that were never web
// services — passed it, verified by rendering exactly that.
test("every rendered row reports the status the published record holds", async () => {
  const { districts } = (await Bun.file(`${dist}/districts.json`).json()) as {
    districts: District[];
  };
  const html = await read("index.html");
  expect(districts.length).toBeGreaterThan(0);

  for (const d of districts) {
    const row = new RegExp(`<summary[^>]*data-id="${d.id}"[^>]*>([\\s\\S]*?)</summary>`).exec(
      html,
    )?.[1];
    expect(row).toBeDefined();

    const text = (row ?? "").replace(/<[^>]*>/g, "");
    expect(text.startsWith(MARK[d.status])).toBe(true);
    expect(text).toContain(replyFor(d.status, d.code));
  }
});

test("the plain-text branch reports the same statuses as the record", async () => {
  const { districts } = (await Bun.file(`${dist}/districts.json`).json()) as {
    districts: District[];
  };
  const lines = (await read("plain.txt")).split("\n");

  for (const d of districts) {
    const line = lines.find((l) => l.includes(` ${d.id} `) || l.trimEnd().endsWith(` ${d.id}`));
    expect(line).toBeDefined();
    expect(line).toContain(MARK[d.status]);
    expect(line).toContain(replyFor(d.status, d.code));
  }
});

test("the plain-text branch and the html map report identical counts", async () => {
  const txt = await read("plain.txt");
  const html = await read("index.html");
  const line = /(\d+) districts · (\d+) alive · (\d+) cold/;
  const a = txt.match(line);
  const b = html.match(line);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a?.slice(1)).toEqual(b?.slice(1));
});

test("the plain-text branch renders every district", async () => {
  const txt = await read("plain.txt");
  const { districts } = await loadDistricts();
  for (const d of districts) expect(txt).toContain(d.id);
});

test("llms.txt lists districts and points at the raw records", async () => {
  const txt = await read("llms.txt");
  expect(txt).toContain("# zae.life");
  expect(txt).toContain("districts.json");
});

test("robots.txt does not block AI crawlers", async () => {
  const txt = await read("robots.txt");
  expect(txt).toContain("Allow: /");
  expect(txt).not.toMatch(/Disallow:\s*\//);
});

// Nothing executes behind this site; a card would advertise a capability that
// does not exist, which is false witness aimed at machines rather than people.
test("no agent card is published", async () => {
  expect(await Bun.file(`${dist}/.well-known/agent.json`).exists()).toBe(false);
  expect(await Bun.file(`${dist}/.well-known/agent-card.json`).exists()).toBe(false);
});

test("the advertised windows are pages, not 404s", async () => {
  expect(await Bun.file(`${dist}/log/index.html`).exists()).toBe(true);
  expect(await Bun.file(`${dist}/me/index.html`).exists()).toBe(true);
});

// With no attestations published, nothing may claim there are any.
test("the empty journal says it is empty rather than pretending", async () => {
  const log = await read("log/index.html");
  expect(log).toContain("0 attestations");
  expect(log).toContain("none published yet");
});

test("no feed is advertised while there is nothing to feed", async () => {
  const html = await read("index.html");
  expect(html).not.toContain('rel="alternate"');
});

// The regex is imported, not copied: a copy would keep passing after the real
// one changed, which is the same failure as a test asserting on source text.
test("the middleware matches terminal agents and not browsers", () => {
  expect(TERMINAL_UA.test("curl/8.4.0")).toBe(true);
  expect(TERMINAL_UA.test("Wget/1.21")).toBe(true);
  expect(TERMINAL_UA.test("HTTPie/3.2.2")).toBe(true);
  expect(TERMINAL_UA.test("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120")).toBe(false);
  expect(TERMINAL_UA.test("Googlebot/2.1")).toBe(false);
});
