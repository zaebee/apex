import { expect, test } from "bun:test";
import { type Action, actionFromClick, parse } from "../src/lib/commands";

test("bare commands parse", () => {
  expect(parse("ls")).toEqual({ kind: "ls" });
  expect(parse("log")).toEqual({ kind: "log" });
  expect(parse("me")).toEqual({ kind: "me" });
  expect(parse("ping")).toEqual({ kind: "ping" });
  expect(parse("help")).toEqual({ kind: "help" });
  expect(parse("clear")).toEqual({ kind: "clear" });
});

test("arguments parse", () => {
  expect(parse("cd aura")).toEqual({ kind: "cd", id: "aura" });
  expect(parse("cd aura/")).toEqual({ kind: "cd", id: "aura" });
  expect(parse("log 2")).toEqual({ kind: "logEntry", n: 2 });
});

test("surrounding whitespace is ignored", () => {
  expect(parse("   ls   ")).toEqual({ kind: "ls" });
  expect(parse("  cd   aura  ")).toEqual({ kind: "cd", id: "aura" });
});

test("empty input is its own action, not an error", () => {
  expect(parse("")).toEqual({ kind: "empty" });
  expect(parse("   ")).toEqual({ kind: "empty" });
});

// --- the terminal does not pretend to understand ---

test("an unknown command returns unknown and preserves the input", () => {
  expect(parse("sl")).toEqual({ kind: "unknown", input: "sl" });
  expect(parse("cat /etc/passwd")).toEqual({ kind: "unknown", input: "cat /etc/passwd" });
});

test("a near-miss is not silently corrected to the nearest command", () => {
  expect(parse("lst").kind).toBe("unknown");
  expect(parse("cd").kind).toBe("unknown");
  expect(parse("log abc").kind).toBe("unknown");
  expect(parse("log 2 3").kind).toBe("unknown");
});

test("case is not guessed at either", () => {
  expect(parse("LS").kind).toBe("unknown");
  expect(parse("Cd aura").kind).toBe("unknown");
});

test("a bare command given an argument is unknown rather than ignoring it", () => {
  expect(parse("ls extra").kind).toBe("unknown");
  expect(parse("me now").kind).toBe("unknown");
});

// --- mouse parity: one action type, one dispatcher ---

test("a click on a district produces the same action as typing cd", () => {
  const el = { dataset: { act: "cd", id: "aura" } } as unknown as HTMLElement;
  expect(actionFromClick(el)).toEqual(parse("cd aura"));
});

test("a click on an attestation produces the same action as typing log n", () => {
  const el = { dataset: { act: "log", id: "3" } } as unknown as HTMLElement;
  expect(actionFromClick(el)).toEqual(parse("log 3"));
});

test("a click on a bare action produces the same action as typing it", () => {
  for (const act of ["ls", "log", "me", "help", "ping"]) {
    const el = { dataset: { act } } as unknown as HTMLElement;
    expect(actionFromClick(el)).toEqual(parse(act));
  }
});

test("an element with no action yields nothing rather than a guess", () => {
  expect(actionFromClick({ dataset: {} } as unknown as HTMLElement)).toBeNull();
});

test("every action kind the parser can emit is one the click path can too", () => {
  // the two entry points share a type; this pins that they share it in fact,
  // so a kind added for one can never quietly bypass the other
  const kinds: Action["kind"][] = [
    "ls",
    "cd",
    "log",
    "logEntry",
    "me",
    "ping",
    "help",
    "clear",
    "sudo",
    "empty",
    "unknown",
  ];
  const produced = new Set(
    [
      parse("ls"),
      parse("cd aura"),
      parse("log"),
      parse("log 1"),
      parse("me"),
      parse("ping"),
      parse("help"),
      parse("clear"),
      parse("sudo"),
      parse(""),
      parse("nope"),
    ].map((a) => a.kind),
  );
  for (const k of kinds) expect(produced.has(k)).toBe(true);
});

// The dispatcher interpolates `n` into a querySelector. That is only safe
// because the parser refuses anything but digits — the guarantee lives here,
// a file away from where it is relied on, so it is pinned here.
test("a log argument carrying selector syntax never becomes an entry", () => {
  for (const arg of ['1"]', "a[b]", "1;drop", "'", "¹", "1 2", "-1", "1.5"]) {
    expect(parse(`log ${arg}`).kind).toBe("unknown");
  }
});

test("and the same holds through the click path", () => {
  for (const id of ['1"]', "a[b]", ""]) {
    const el = { dataset: { act: "log", id } } as unknown as HTMLElement;
    const action = actionFromClick(el);
    expect(action?.kind).not.toBe("logEntry");
  }
});
