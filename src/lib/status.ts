/** The five states a district can be in. Two would lie: several districts were
 *  never web services, and colouring them "dead" is the same species of
 *  falsehood as colouring everything green. */
export type Status = "alive" | "cold" | "offline" | "private" | "unknown";

export interface HealthEntry {
  host: string;
  ok: boolean;
  code: number | null;
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

export const REPLY: Record<Status, string> = {
  alive: "200 OK",
  cold: "timeout",
  offline: "no service",
  private: "private",
  unknown: "unknown",
};

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
  if (entry?.ok === true) return "alive";
  if (entry?.ok === false) return "cold";
  return "unknown";
}
