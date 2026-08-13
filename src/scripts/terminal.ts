import { type Action, actionFromClick, parse } from "../lib/commands";

const term = document.getElementById("term");
const stream = document.getElementById("stream");
const sink = document.getElementById("sink") as HTMLInputElement | null;
const typed = document.getElementById("typed");
const hint = document.getElementById("hint");
if (!term || !stream || !sink || !typed || !hint) throw new Error("terminal markup missing");

const history: string[] = [];
let hpos = -1;

/** Everything interpolated into innerHTML below passes through here first, and
 *  every interpolation site is text content between tags — never an attribute
 *  value — so escaping the three markup-significant characters is sufficient.
 *  The values are typed input, the district id from a data attribute, and host
 *  and status fields decoded from the /api/ping response. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function emit(html: string, echo?: string) {
  const block = document.createElement("div");
  block.className = "block";
  block.innerHTML = (echo ? `<pre class="echo">zae.life ~ $ <b>${esc(echo)}</b></pre>` : "") + html;
  stream?.appendChild(block);
  block.scrollIntoView({ block: "nearest" });
  return block;
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
async function livePing(block: HTMLElement) {
  const fail = (why: string) => {
    block.innerHTML =
      `<pre class="prose"><span class="warn">  ${esc(why)}</span>\n` +
      `<span class="dim">  That is unknown, not dead — the snapshot above still stands, with its age.</span></pre>`;
  };

  try {
    const res = await fetch("/api/ping", { headers: { accept: "application/json" } });
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
    block.innerHTML =
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
      const el = document.querySelector<HTMLDetailsElement>(
        `details[data-act="cd"][data-id="${CSS.escape(action.id)}"]`,
      );
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
      const block = emit(dim("  probing …"), echo);
      void livePing(block);
      return;
    }

    case "clear":
      stream?.replaceChildren();
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
    sink?.focus();
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
    if (hpos < history.length - 1) hpos++;
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

sink.focus();
