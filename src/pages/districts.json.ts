import type { APIRoute } from "astro";
import { loadDistricts } from "../lib/districts";

// A witness whose testimony cannot be examined is asking to be taken on trust.
// The record the page was drawn from is published beside it, so anyone — person
// or agent — can check that the rendered map agrees with the data underneath.
export const GET: APIRoute = async () => {
  const { districts, health } = await loadDistricts();

  return new Response(
    `${JSON.stringify({ checkedAt: health?.checkedAt ?? null, healthOk: health?.ok ?? false, districts }, null, 2)}\n`,
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
};
