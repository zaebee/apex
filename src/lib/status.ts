/** The five states a district can be in. Two would lie: several districts were
 *  never web services, and colouring them "dead" is the same species of
 *  falsehood as colouring everything green. */
export type Status = "alive" | "cold" | "offline" | "private" | "unknown";

export interface HealthEntry {
  host: string;
  ok: boolean;
  code: number | null;
  /** Where the probe landed, recorded whenever it differs from what was
   *  requested — including same-host redirects. This is the record: a reader
   *  checks the judgment below against it, which they cannot do if only the
   *  cases the code already decided are kept. */
  finalUrl?: string | null;
  /** The judgment: the landing was a different host, so whatever answered, it
   *  was not this district. Kept separate from finalUrl on purpose — one is
   *  what was seen, the other is what was concluded from it. */
  offSite?: boolean;
}

export interface HealthSnapshot {
  checkedAt: string;
  /** False when the check itself failed. The snapshot then carries no testimony. */
  ok: boolean;
  /** When a check last succeeded, carried forward across failed runs so the page
   *  can say how old the last real observation is instead of only that there
   *  isn't a current one. */
  lastOkAt?: string | null;
  entries: Record<string, HealthEntry>;
}

export interface StatusInput {
  host?: string;
  visibility?: "public" | "private";
}

export const MARK: Record<Status, string> = {
  alive: "●",
  cold: "○",
  offline: "·",
  private: "▪",
  unknown: "?",
};

/** What the check actually got back. A constant per status would testify past
 *  observation: a host answering 502 is not a timeout, and printing "timeout"
 *  over it names a failure mode nobody saw. When there is a code, the code is
 *  the testimony; when the connection never completed, there is no code and
 *  "no answer" is all that can honestly be said. */
/** The standard reason phrase for a code, where one exists. Not an
 *  interpretation added on top: 502 *is* bad gateway by definition, and a
 *  visitor reading "502" beside "no answer" is being handed two different
 *  levels of abstraction and asked to reconcile them. The raw code stays in
 *  the card and in /health.json, so nothing is lost. */
const REASON: Record<number, string> = {
  400: "bad request",
  401: "unauthorized",
  403: "forbidden",
  404: "not found",
  408: "timeout",
  429: "throttled",
  500: "server error",
  502: "bad gateway",
  503: "unavailable",
  504: "timeout",
};

export function replyFor(status: Status, code: number | null): string {
  switch (status) {
    case "alive":
      return code === null ? "ok" : `${code} OK`;
    case "cold":
      if (code === null) return "no answer";
      return REASON[code] ?? String(code);
    case "offline":
      return "no service";
    case "private":
      return "private";
    case "unknown":
      return "unknown";
  }
}

/** Amber belongs to epistemic uncertainty alone. A cold district is a fact,
 *  not a warning, and colouring it as a problem would editorialise the census. */
export const TONE: Record<Status, "alive" | "dim" | "warn"> = {
  alive: "alive",
  cold: "dim",
  offline: "dim",
  private: "dim",
  unknown: "warn",
};

export function resolveStatus(d: StatusInput, snapshot: HealthSnapshot | null): Status {
  if (!d.host) return "offline";
  if (d.visibility === "private") return "private";
  // Compared by value, never by truthiness. These files are machine-written
  // JSON read back through a bare cast, so a producer bug or a botched merge
  // can put a string where a boolean belongs — and the string "false" is
  // truthy, which would render a snapshot that says false twice as green.
  // Anything that is not exactly `true` or exactly `false` was not observed.
  if (snapshot?.ok !== true) return "unknown";

  const entry = snapshot.entries[d.host];

  // A hostname that now sends the probe to a different host was not observed —
  // something else was, at that address. A lapsed domain landing on a
  // registrar's parking page answers 200, and calling that alive would report
  // the day a district died as the day it turned green. Neither alive nor cold
  // is true: the check reached a server and learned nothing about this district.
  // Compared by value, like every other gate here.
  if (entry?.offSite === true) return "unknown";

  if (entry?.ok === true) return "alive";
  if (entry?.ok === false) return "cold";
  return "unknown";
}
