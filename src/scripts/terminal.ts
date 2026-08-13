import { type Action, actionFromClick, parse } from "../lib/commands";

const term = document.getElementById("term");
const output = document.getElementById("output");
const sink = document.getElementById("sink") as HTMLInputElement | null;
const typed = document.getElementById("typed");
const hint = document.getElementById("hint");
if (!term || !output || !sink || !typed || !hint) throw new Error("terminal markup missing");

const history: string[] = [];
let hpos = -1;

/** Everything interpolated into innerHTML below passes through here first, and
 *  every interpolation site is text content between tags — never an attribute
 *  value — so escaping the three markup-significant characters is sufficient.
 *  The values are typed input, the district id from a data attribute, and host
 *  and status fields decoded from the /api/ping response. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Returns the result element, not the whole block, so a long-running command
 *  can replace its own output without deleting the record of what was asked. */
function emit(html: string, echo?: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "block";

  if (echo) {
    const line = document.createElement("pre");
    line.className = "echo";
    line.innerHTML = `zae.life ~ $ <b>${esc(echo)}</b>`;
    block.appendChild(line);
  }

  const result = document.createElement("div");
  result.innerHTML = html;
  block.appendChild(result);

  output?.appendChild(block);
  block.scrollIntoView({ block: "nearest" });
  return result;
}

const dim = (text: string) => `<pre class="prose"><span class="dim">${esc(text)}</span></pre>`;

const HELP = [
  "  Everything here is clickable. Typing is the other way in, never the only one.",
  "",
  "  ls              the map: every district, live status, real build stats",
  "  cd <district>   open one district",
  "  log             list attestations",
  "  log <n>         open entry n",
  "  me              who, and how to reach me",
  "  ping            probe every district now, ignoring the snapshot",
  "  clear           clear the screen",
  "  help            this",
  "",
  "  ● answering now    ○ was deployed, silent now    · never a web service",
  "  ▪ private          ? the check itself could not observe",
  "",
  "  ↑ ↓ for history. The map ran before you arrived — nothing needed typing.",
].join("\n");

interface PingEntry {
  host: string;
  ok: boolean;
  code: number | null;
}
interface PingSnapshot {
  checkedAt: string;
  ok: boolean;
  entries: Record<string, PingEntry>;
}

/** Replaces its own "probing…" block rather than appending under it, so the
 *  transcript never shows a pending line above a finished one. */
async function livePing(result: HTMLElement, signal: AbortSignal) {
  const fail = (why: string) => {
    result.innerHTML =
      `<pre class="prose"><span class="warn">  ${esc(why)}</span>\n` +
      `<span class="dim">  That is unknown, not dead — the snapshot above still stands, with its age.</span></pre>`;
  };

  try {
    const res = await fetch("/api/ping", { headers: { accept: "application/json" }, signal });
    if (!res.ok) return fail(`the probe endpoint answered ${res.status}.`);

    const snap = (await res.json()) as PingSnapshot;
    const all = Object.values(snap.entries ?? {});

    // ok describes the check, not the hosts: if it could not reach its control
    // host it observed nothing, and printing per-host results would dress a
    // blind run as a reading
    if (snap.ok !== true || all.length === 0) return fail("the probe itself could not observe.");

    const rows = all
      .map((e) => {
        const green = e.ok === true;
        const mark = `<span class="${green ? "alive" : "dim"}">${green ? "●" : "○"}</span>`;
        const reply = green
          ? `${e.code ?? ""} OK`.trim()
          : e.code === null
            ? "no answer"
            : String(e.code);
        return `  ${mark}  ${esc(e.host.padEnd(24))}${esc(reply)}`;
      })
      .join("\n");

    const answering = all.filter((e) => e.ok === true).length;
    result.innerHTML =
      `<pre class="prose">${rows}\n\n` +
      `<span class="dim">  probed just now · ${answering}/${all.length} answering</span></pre>`;
  } catch {
    fail("the probe could not be reached.");
  }
}

function dispatch(action: Action, echo: string) {
  switch (action.kind) {
    case "empty":
      return;

    // Navigation actions go to real URLs: the windows are presentation, the
    // routes underneath are what make a single attestation shareable.
    case "ls":
      if (location.pathname !== "/") location.href = "/";
      return;
    case "log":
      location.href = "/log";
      return;
    case "logEntry":
      location.href = `/log/${action.n}`;
      return;
    case "me":
      location.href = "/me";
      return;

    case "cd": {
      const summary = document.querySelector<HTMLElement>(
        `summary[data-act="cd"][data-id="${CSS.escape(action.id)}"]`,
      );
      const el = summary?.closest("details") ?? null;
      if (!el) {
        // off the map: let the map's own anchor handle it rather than claiming
        // the district does not exist from a page that never listed it
        if (location.pathname !== "/") {
          location.href = `/#${encodeURIComponent(action.id)}`;
          return;
        }
        emit(
          `<pre class="prose"><span class="warn">  no district "${esc(action.id)}". try: ls</span></pre>`,
          echo,
        );
        return;
      }
      // the same property a click toggles and a no-JS visitor toggles: one
      // thing to change, so the two paths cannot mean different things
      el.open = !el.open;
      if (el.open) el.scrollIntoView({ block: "nearest" });
      return;
    }

    case "help":
      emit(dim(HELP), echo);
      return;

    case "ping": {
      const result = emit(dim("  probing …"), echo);
      // bounded like the probe itself: a stalled connection must not leave
      // "probing …" standing forever, which reads as a pending observation
      void livePing(result, AbortSignal.timeout(20_000));
      return;
    }

    case "clear":
      output?.replaceChildren();
      return;

    case "sudo":
      emit(
        `<pre class="prose"><span class="dim">  zaebee is not in the sudoers file.</span>\n  You are, though. This whole city is unlocked — that is the point.</pre>`,
        echo,
      );
      return;

    case "unknown":
      emit(
        `<pre class="prose"><span class="warn">  ${esc(action.input.split(/\s+/)[0] ?? "")}: unknown command</span>\n` +
          `<span class="dim">  Not pretending to understand. try: help</span></pre>`,
        echo,
      );
      return;
  }
}

term.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
  if (el) {
    const action = actionFromClick(el);
    if (action) {
      e.preventDefault();
      const echo =
        el.dataset.act === "cd"
          ? `cd ${el.dataset.id}`
          : el.dataset.act === "log" && el.dataset.id
            ? `log ${el.dataset.id}`
            : (el.dataset.act ?? "");
      dispatch(action, echo);
    }
    // Keyboard activation of a <summary> fires a click with detail 0. Pulling
    // focus into the hidden sink there would teleport a keyboard user past
    // every remaining row and past the card they just opened; a pointer user
    // expects the prompt to stay live.
    if (e.detail !== 0) sink?.focus();
    return;
  }
  // a click meant to select text should not steal focus mid-selection
  if (window.getSelection()?.toString()) return;
  sink?.focus();
});

sink.addEventListener("input", () => {
  if (!typed || !hint || !sink) return;
  typed.textContent = sink.value;
  hint.style.visibility = sink.value ? "hidden" : "";
});

sink.addEventListener("keydown", (e) => {
  if (!typed || !hint || !sink) return;

  if (e.key === "Enter") {
    e.preventDefault();
    const line = sink.value;
    if (line.trim()) history.unshift(line.trim());
    hpos = -1;
    dispatch(parse(line), line.trim());
    sink.value = "";
    typed.textContent = "";
    hint.style.visibility = "";
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    // guard the assignment, not just the increment: with no history at all the
    // unguarded write erased whatever the visitor had typed
    if (hpos >= history.length - 1) return;
    hpos++;
    sink.value = history[hpos] ?? "";
    typed.textContent = sink.value;
    hint.style.visibility = sink.value ? "hidden" : "";
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    hpos = hpos > 0 ? hpos - 1 : -1;
    sink.value = hpos >= 0 ? (history[hpos] ?? "") : "";
    typed.textContent = sink.value;
    hint.style.visibility = sink.value ? "hidden" : "";
  }
});

/** `cd` from another page navigates to /#<id>. Without this the visitor lands
 *  on a closed row, which is not what the spec says cd does. */
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const summary = document.querySelector<HTMLElement>(
    `summary[data-act="cd"][data-id="${CSS.escape(id)}"]`,
  );
  const el = summary?.closest("details");
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ block: "nearest" });
}

window.addEventListener("hashchange", openFromHash);
openFromHash();

sink.focus();
