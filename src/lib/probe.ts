import type { HealthEntry, HealthSnapshot } from "./status";

/** `www.` is the one prefix that conventionally names the same site, so a
 *  redirect across it is not a redirect away from the district. Everything else
 *  is a different host, whatever it happens to serve. */
const bare = (h: string) => h.replace(/^www\./i, "").toLowerCase();

export function sameSite(probed: string, finalUrl: string): boolean {
  try {
    return bare(new URL(finalUrl).hostname) === bare(probed);
  } catch {
    // an unparseable final URL is not evidence that it was the same place
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

    const landed = res.url || `https://${host}/`;
    const offSite = !sameSite(host, landed);

    return {
      host,
      ok: !offSite && res.status >= 200 && res.status < 400,
      code: res.status,
      redirectedTo: offSite ? landed : null,
    };
  } catch {
    return { host, ok: false, code: null, redirectedTo: null };
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
