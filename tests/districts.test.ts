import { expect, test } from "bun:test";
import { mergeDistricts } from "../src/lib/districts";
import type { HealthSnapshot } from "../src/lib/status";

const toml = `
[aura]
repo  = "zaebee/aura"
host  = "aura.zae.life"
title = "aura"
what  = "Agent negotiation infrastructure"
why   = "Wanted agents that could settle a price without me."

[hivemark]
repo  = "zaebee/hivemark"
title = "hivemark"
what  = "Track records for code-review agents"
`;

const stats = {
  "zaebee/aura": { commits: 517, activeDays: 41, first: "2026-01-24", last: "2026-08-13" },
  "zaebee/hivemark": { commits: 66, activeDays: 2, first: "2026-08-12", last: "2026-08-13" },
};

const health: HealthSnapshot = {
  checkedAt: "2026-08-13T10:00:00.000Z",
  ok: true,
  entries: { "aura.zae.life": { host: "aura.zae.life", ok: true, code: 200 } },
};

test("only stanzas in the toml become districts", () => {
  const merged = mergeDistricts(
    toml,
    { ...stats, "zaebee/secret": { commits: 9, activeDays: 1, first: "x", last: "y" } },
    health,
  );
  expect(merged.map((d) => d.id).sort()).toEqual(["aura", "hivemark"]);
});

test("numbers come from stats", () => {
  const aura = mergeDistricts(toml, stats, health).find((d) => d.id === "aura");
  expect(aura?.stats?.commits).toBe(517);
  expect(aura?.stats?.activeDays).toBe(41);
});

test("a district with no matching stats entry carries null stats rather than zeroes", () => {
  const merged = mergeDistricts(toml, {}, health);
  expect(merged.find((d) => d.id === "aura")?.stats).toBeNull();
});

test("status is resolved, not stored", () => {
  const merged = mergeDistricts(toml, stats, health);
  expect(merged.find((d) => d.id === "aura")?.status).toBe("alive");
  expect(merged.find((d) => d.id === "hivemark")?.status).toBe("offline");
});

test("a failed snapshot renders every hosted district unknown", () => {
  const merged = mergeDistricts(toml, stats, { ...health, ok: false });
  expect(merged.find((d) => d.id === "aura")?.status).toBe("unknown");
});

// --- the ownership split ---

test("stats cannot supply prose the author did not write", () => {
  const poisoned = {
    ...stats,
    "zaebee/hivemark": {
      ...stats["zaebee/hivemark"],
      why: "generated rationale",
      learned: "generated lesson",
      title: "Hivemark (auto)",
      what: "auto description",
    },
  } as unknown as typeof stats;

  const hivemark = mergeDistricts(toml, poisoned, health).find((d) => d.id === "hivemark");
  expect(hivemark?.why).toBeNull();
  expect(hivemark?.learned).toBeNull();
  expect(hivemark?.title).toBe("hivemark");
  expect(hivemark?.what).toBe("Track records for code-review agents");
});

test("prose absent from the toml stays null so the page can mark it unwritten", () => {
  const hivemark = mergeDistricts(toml, stats, health).find((d) => d.id === "hivemark");
  expect(hivemark?.why).toBeNull();
  expect(hivemark?.learned).toBeNull();
});

test("stats cannot supply text through the date fields either", () => {
  const poisoned = {
    "zaebee/hivemark": {
      commits: 1,
      activeDays: 1,
      first: "<script>alert(1)</script>",
      last: "REDEPLOYED, ALL GREEN",
    },
  } as unknown as typeof stats;

  const hivemark = mergeDistricts(toml, poisoned, health).find((d) => d.id === "hivemark");
  expect(hivemark?.stats?.last).toBe("");
  expect(hivemark?.stats?.first).toBe("");
  expect(hivemark?.stats?.commits).toBe(1);
});

test("a real date survives the shape check", () => {
  const aura = mergeDistricts(toml, stats, health).find((d) => d.id === "aura");
  expect(aura?.stats?.last).toBe("2026-08-13");
});

test("a stray top-level scalar is an authoring error, not a phantom district", () => {
  expect(() =>
    mergeDistricts('tagline = "stray line"\n\n[aura]\nhost = "a.zae.life"\n', {}, null),
  ).toThrow(/tagline/);
});

test("prose present in the toml survives the merge", () => {
  const aura = mergeDistricts(toml, stats, health).find((d) => d.id === "aura");
  expect(aura?.why).toBe("Wanted agents that could settle a price without me.");
});

test("the shipped allowlist parses and every stanza yields a district", async () => {
  const shipped = await Bun.file("data/districts.toml").text();
  const merged = mergeDistricts(shipped, {}, null);
  expect(merged.length).toBeGreaterThan(0);
  for (const d of merged) {
    expect(d.id.length).toBeGreaterThan(0);
    expect(d.title.length).toBeGreaterThan(0);
  }
});
