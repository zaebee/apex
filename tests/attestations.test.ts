import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";

const DIR = "src/content/log";
const dist = "dist/client";

async function entries(): Promise<string[]> {
  try {
    return (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

// The schema requires all three fields, so a missing one fails the build rather
// than shipping. This asserts the harder thing the schema cannot: that the
// third field does the work it exists for.
test("every attestation names the limit of its own testimony", async () => {
  for (const f of await entries()) {
    const text = await Bun.file(`${DIR}/${f}`).text();
    const attested = /^attested:\s*"?(.*?)"?\s*$/m.exec(text)?.[1] ?? "";

    expect(attested.length).toBeGreaterThan(0);
    // an `attested` that only restates the claim is the field going through the
    // motions; the one thing it must do is say what is NOT supported
    expect(attested.toLowerCase()).toContain("not");
  }
});

test("the journal reports its own size honestly", async () => {
  const n = (await entries()).length;
  const html = await Bun.file(`${dist}/log/index.html`).text();
  expect(html).toContain(`${n} attestation`);
  if (n === 0) expect(html).toContain("none published yet");
});

// A feed is advertised only once there is something in it. An empty feed is a
// small false promise, and this site does not get to make those.
test("rss and its link appear together with the entries, or not at all", async () => {
  const n = (await entries()).length;
  const map = await Bun.file(`${dist}/index.html`).text();
  const log = await Bun.file(`${dist}/log/index.html`).text();

  if (n === 0) {
    expect(map).not.toContain('rel="alternate"');
    expect(log).not.toContain("/rss.xml");
  } else {
    expect(map).toContain('rel="alternate"');
    expect(log).toContain("/rss.xml");
    const feed = await Bun.file(`${dist}/rss.xml`).text();
    expect((feed.match(/<item>/g) ?? []).length).toBe(n);
  }
});

test("each attestation is reachable at its own url", async () => {
  for (const f of await entries()) {
    const slug = f.replace(/\.md$/, "");
    expect(await Bun.file(`${dist}/log/${slug}/index.html`).exists()).toBe(true);
  }
});
