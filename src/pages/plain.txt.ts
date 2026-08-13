import type { APIRoute } from "astro";
import { loadDistricts } from "../lib/districts";
import { continuationIndent, districtRow, pad, secondLineFor, summaryLines } from "../lib/format";

// Same formatter as the HTML map, so the two renderings cannot disagree about
// the same district. `curl zae.life` is served this by the edge middleware.
export const GET: APIRoute = async () => {
  const now = new Date();
  const { districts, health } = await loadDistricts();
  const observed = health?.ok === true;
  const cold = districts.filter((d) => d.status === "cold").length;

  // built above the array so the sentence is assembled once, in plain
  // statements, rather than as template literals nested inside a spread
  const subject = cold === 1 ? "One district is" : `${cold} districts are`;
  const them = cold === 1 ? "it" : "them";
  const coldLines =
    observed && cold > 0
      ? [
          `  ${subject} not answering. That is`,
          `  accurate — I have not redeployed ${them}. Claiming otherwise`,
          "  would have been easier.",
          "",
        ]
      : [];

  const body = [
    "",
    "  zaebee · witness, apprentice",
    "",
    ...summaryLines(districts, health, now).map((l) => `  ${l}`),
    "",
    ...districts.flatMap((d) => {
      const row = `  ${districtRow(d)}`;
      const second = secondLineFor(d, now);
      // derived, not a literal: these rows carry a two-space prefix the page's
      // do not, and a hardcoded indent landed two columns off the host column
      return second ? [row, `${" ".repeat(2 + continuationIndent(d))}${second}`] : [row];
    }),
    "",
    // the same rule the page follows: this line asserts a count, so it may only
    // appear when the check that produced the count actually succeeded
    ...coldLines,
    // padded rather than spaced by eye, so the column cannot drift when a line
    // is added
    ...(
      [
        ["curl https://zae.life", "this, plain text"],
        ["bee@zae.life", "write"],
        ["https://zae.life/districts.json", "the merged record"],
        ["https://zae.life/health.json", "the raw snapshot"],
        ["https://zae.life/history.json", "how long each has read that way"],
      ] as Array<[string, string]>
    ).map(([left, right]) => `  ${pad(left, 35)}${right}`),
    "",
  ].join("\n");

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
