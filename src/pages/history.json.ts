import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";

// The map says a district is silent. This says across how many checks, since
// when, and with how many holes — and publishes the counts the page renders
// from, so the claim can be checked rather than believed.
export const GET: APIRoute = async () => {
  let body: string;
  try {
    body = await readFile("data/history.json", "utf8");
  } catch {
    body = `${JSON.stringify({ updatedAt: null, hosts: {} }, null, 2)}\n`;
  }
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
};
