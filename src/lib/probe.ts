import type { HealthEntry, HealthSnapshot } from "./status";

/** `www.` is the one prefix that conventionally names the same site, so a
 *  redirect across it is not a redirect away from the district. A trailing root
 *  dot names the same host too. Everything else is a different host, whatever
 *  it happens to serve. */
const bare = (h: string) =>
  h
    .replace(/\.$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();

/** Both sides go through the URL parser. `res.url` is always serialized, so a
 *  Cyrillic host arrives back as punycode — comparing it against the raw string
 *  from districts.toml reported a district as having redirected to its own
 *  hostname, and marked a live district unknown for its spelling. */
export function sameSite(probed: string, finalUrl: string): boolean {
  try {
    return bare(new URL(`https://${probed}/`).hostname) === bare(new URL(finalUrl).hostname);
  } catch {
    // an unparseable URL on either side is not evidence that it was the same place
    return false;
  }
}

export async function probe(
  host: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<HealthEntry> {
  try {
    const res = await fetchImpl(`https://${host}/`, {
      method: "GET",
      // Followed on purpose: a live district may legitimately redirect — to
      // https, to a locale, to a trailing slash. Where it landed is what
      // decides whether the district was observed, so it is recorded.
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "zae.life health check (+https://zae.life)" },
    });

    const requested = `https://${host}/`;
    const landed = res.url || requested;
    const offSite = !sameSite(host, landed);

    return {
      host,
      ok: !offSite && res.status >= 200 && res.status < 400,
      code: res.status,
      // recorded whenever the probe moved, same host or not: the record has to
      // include the cases the judgment cleared, or the judgment is unfalsifiable
      finalUrl: landed === requested ? null : landed,
      offSite,
    };
  } catch {
    return { host, ok: false, code: null, finalUrl: null, offSite: false };
  }
}

/** A host outside the constellation, used to tell "they are down" apart from
 *  "I am blind". Its result is never published as a district. */
export const CONTROL_HOST = "github.com";

/** `ok` describes the check, not the hosts. Individual failures are data — a
 *  district that does not answer is an observation. But a runner that has lost
 *  egress observes every host as down, which renders identically to every
 *  district actually being down while being a completely different claim. So
 *  the check probes a control host it expects to answer, and reports `ok: false`
 *  when even that fails: a check that could not observe anything carries no
 *  testimony at all. */
export async function buildSnapshot(
  hosts: string[],
  now: Date,
  fetchImpl: typeof fetch = fetch,
  opts: { controlHost?: string; previous?: HealthSnapshot | null } = {},
): Promise<HealthSnapshot> {
  const [control, results] = await Promise.all([
    probe(opts.controlHost ?? CONTROL_HOST, fetchImpl),
    Promise.all(hosts.map((h) => probe(h, fetchImpl))),
  ]);

  const ok = hosts.length > 0 && control.ok;

  return {
    checkedAt: now.toISOString(),
    ok,
    // carried forward so the page can say how old the last real observation is,
    // rather than only that there is no current one
    lastOkAt: ok ? now.toISOString() : (opts.previous?.lastOkAt ?? null),
    entries: Object.fromEntries(results.map((e) => [e.host, e])),
  };
}
