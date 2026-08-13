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
  // no snapshot, or a snapshot whose own check failed — both are absence of
  // observation, and absence of observation is never green
  if (!snapshot?.ok) return "unknown";

  const entry = snapshot.entries[d.host];
  if (!entry) return "unknown";

  return entry.ok ? "alive" : "cold";
}
