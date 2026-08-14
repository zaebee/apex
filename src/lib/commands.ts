export type Action =
  | { kind: "ls" }
  | { kind: "cd"; id: string }
  | { kind: "log" }
  | { kind: "logEntry"; n: number }
  | { kind: "me" }
  | { kind: "ping" }
  | { kind: "help" }
  | { kind: "clear" }
  | { kind: "sudo" }
  | { kind: "empty" }
  | { kind: "dismiss" }
  | { kind: "unknown"; input: string };

const BARE = ["ls", "districts", "whoami", "me", "ping", "help", "clear", "sudo"] as const;

const BARE_KIND: Record<(typeof BARE)[number], Action["kind"]> = {
  ls: "ls",
  districts: "ls",
  whoami: "ls",
  me: "me",
  ping: "ping",
  help: "help",
  clear: "clear",
  sudo: "sudo",
};

const isBare = (s: string): s is (typeof BARE)[number] => (BARE as readonly string[]).includes(s);

/** Anything not recognised comes back as `unknown` carrying the original input.
 *  No fuzzy matching, no case folding, no nearest-command guess — a terminal
 *  that invents an interpretation is telling the visitor something it does not
 *  know, which is the same failure as painting an unobserved district green. */
export function parse(input: string): Action {
  const line = input.trim();
  if (!line) return { kind: "empty" };

  const parts = line.split(/\s+/);
  const cmd = parts[0] ?? "";
  const arg = parts.slice(1).join(" ");

  if (isBare(cmd)) {
    // an argument to a command that takes none was meant for something; saying
    // "unknown" is truthful, silently dropping it is not
    return arg ? { kind: "unknown", input: line } : ({ kind: BARE_KIND[cmd] } as Action);
  }

  if (cmd === "cd") {
    const id = arg.replace(/\/$/, "");
    return id && !id.includes(" ") ? { kind: "cd", id } : { kind: "unknown", input: line };
  }

  if (cmd === "log") {
    if (!arg) return { kind: "log" };
    if (!/^\d+$/.test(arg)) return { kind: "unknown", input: line };
    return { kind: "logEntry", n: Number.parseInt(arg, 10) };
  }

  return { kind: "unknown", input: line };
}

/** The mouse path resolves to the same Action the keyboard path produces, and
 *  both are handed to one dispatcher. A click handler that did its own work
 *  would make this a terminal-themed page rather than a terminal. */
/** Escape is the key a reader already tries to get out of something. Nothing
 *  else is a command on its own: the prompt is a text field, and claiming plain
 *  keys would take them from whoever is typing. `Esc` is the legacy spelling
 *  some browsers still send. */
export function actionFromKey(key: string): Action | null {
  return key === "Escape" || key === "Esc" ? { kind: "dismiss" } : null;
}

export function actionFromClick(el: HTMLElement): Action | null {
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (!act) return null;
  if (act === "cd" && id) return parse(`cd ${id}`);
  if (act === "log" && id) return parse(`log ${id}`);
  return parse(act);
}
