import type { APIRoute } from "astro";
import { loadDistricts } from "../lib/districts";
import { replyFor } from "../lib/status";

// A proposed convention with uneven adoption and no provider commitment. It
// ships because it costs one endpoint over data already merged, not because it
// is settled — and because a site holding that machines are readers worth
// writing for should not be legible only to browsers.
export const GET: APIRoute = async () => {
  const { districts, health } = await loadDistricts();

  const lines = [
    "# zae.life",
    "",
    "> zaebee — witness, apprentice. A city of projects, reported as it actually is:",
    "> districts that answer are marked alive, districts that do not are marked cold,",
    "> and state that was never observed is marked unknown rather than guessed.",
    "",
    `Health snapshot: ${health?.ok === true ? health.checkedAt : "none on record"}`,
    "",
    "## Districts",
    "",
    ...districts.map((d) => {
      const where = d.host ? `https://${d.host}` : d.repo ? `https://github.com/${d.repo}` : "—";
      const built = d.stats
        ? ` (${d.stats.commits} commits across ${d.stats.activeDays} active days)`
        : "";
      return `- [${d.id}](${where}): ${d.what ?? d.title} — ${replyFor(d.status, d.code)}${built}`;
    }),
    "",
    "## Attestations",
    "",
    "None published yet.",
    "",
    "## Raw records",
    "",
    "- [districts.json](https://zae.life/districts.json): the merged record this site is drawn from",
    "- [health.json](https://zae.life/health.json): the raw health snapshot with timestamps",
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
