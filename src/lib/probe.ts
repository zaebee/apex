import type { HealthEntry, HealthSnapshot } from "./status";

export async function probe(
  host: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<HealthEntry> {
  try {
    const res = await fetchImpl(`https://${host}/`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "zae.life health check (+https://zae.life)" },
    });
    return { host, ok: res.status >= 200 && res.status < 400, code: res.status };
  } catch {
    return { host, ok: false, code: null };
  }
}

/** `ok` describes the check, not the hosts. Individual failures are data; a
 *  check that observed nothing carries no testimony at all. */
export async function buildSnapshot(
  hosts: string[],
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthSnapshot> {
  const results = await Promise.all(hosts.map((h) => probe(h, fetchImpl)));
  return {
    checkedAt: now.toISOString(),
    ok: hosts.length > 0,
    entries: Object.fromEntries(results.map((e) => [e.host, e])),
  };
}
