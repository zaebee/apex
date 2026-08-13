import type { APIRoute } from "astro";
import { loadDistricts } from "../lib/districts";
import { districtRow, summaryLines } from "../lib/format";

// Same formatter as the HTML map, so the two renderings cannot disagree about
// the same district. `curl zae.life` is served this by the edge middleware.
export const GET: APIRoute = async () => {
  const now = new Date();
  const { districts, health } = await loadDistricts();
  const observed = health?.ok === true;
  const cold = districts.filter((d) => d.status === "cold").length;

  const body = [
    "",
    "  zaebee · witness, apprentice",
    "",
    ...summaryLines(districts, health, now).map((l) => `  ${l}`),
    "",
    ...districts.map((d) => `  ${districtRow(d)}`),
    "",
    // the same rule the page follows: this line asserts a count, so it may only
    // appear when the check that produced the count actually succeeded
    ...(observed && cold > 0
      ? [
          `  ${cold === 1 ? "One district is" : `${cold} districts are`} not answering. That is`,
          `  accurate — I have not redeployed ${cold === 1 ? "it" : "them"}. Claiming otherwise`,
          "  would have been easier.",
          "",
        ]
      : []),
    "  https://zae.life/districts.json    the merged record",
    "  https://zae.life/health.json       the raw snapshot",
    "",
  ].join("\n");

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
