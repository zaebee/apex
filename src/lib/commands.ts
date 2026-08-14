export type Action =
  | { kind: "ls" }
  | { kind: "cd"; id: string }
  | { kind: "evidence"; id: string }
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

  if (cmd === "cd" || cmd === "evidence") {
    const id = arg.replace(/\/$/, "");
    if (!id || id.includes(" ")) return { kind: "unknown", input: line };
    return cmd === "cd" ? { kind: "cd", id } : { kind: "evidence", id };
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

/** Whether Escape belongs to this page at this moment.
 *
 *  Taking it unconditionally pulled focus to the invisible prompt from wherever
 *  it was, on every page — including /log and /me, which render no cards — and
 *  called preventDefault on a key the browser and assistive software have their
 *  own uses for. Acting only when a card is open, the narrow fix, leaves out
 *  what the issue actually asked for: a reader whose focus sits on a closed row
 *  also has no way back to the prompt except cycling Tab through everything
 *  after it. Both count as being somewhere there is something to leave. */
export function dismissApplies(active: Element | null, openCards: number): boolean {
  if (openCards > 0) return true;
  return active?.closest?.("summary") != null;
}

export function actionFromClick(el: HTMLElement): Action | null {
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (!act) return null;
  if (act === "cd" && id) return parse(`cd ${id}`);
  if (act === "log" && id) return parse(`log ${id}`);
  return parse(act);
}
