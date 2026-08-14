import {
  type Action,
  actionFromClick,
  actionFromKey,
  dismissApplies,
  parse,
} from "../lib/commands";

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
  "  evidence <d>    where each line came from: observed, recorded, derived, authored",
  "  log             list attestations",
  "  log <n>         open entry n",
  "  me              who, and how to reach me",
  "  ping            probe every district now, ignoring the snapshot",
  "  clear           clear the screen",
  "  help            this",
  "",
  "  ● answering now    ○ was deployed, silent now    · never a web service",
  "  ▪ private          ? not observed — the check failed, or something else answered",
  "",
  "  ↑ ↓ for history. The map ran before you arrived — nothing needed typing.",
].join("\n");

interface PingEntry {
  host: string;
  ok: boolean;
  code: number | null;
  finalUrl?: string | null;
  offSite?: boolean;
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
        // A host that sent the probe elsewhere is neither alive nor cold, and
        // must read the same here as on the map. Rendering it from `ok` alone
        // printed a hollow circle beside an HTTP code proving it was not silent.
        if (e.offSite === true) {
          const where = e.finalUrl ? ` → ${new URL(e.finalUrl).host}` : "";
          return `  <span class="warn">?</span>  ${esc(e.host.padEnd(24))}${esc(`not this district${where}`)}`;
        }
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

/** `cd` and `evidence` both want a district on this page, and both answer the
 *  same way when it is not here: off the map, hand it to the map's own anchor
 *  rather than claim from a page that never listed it that the district does
 *  not exist. Written once because it was written twice, which put dispatch
 *  over the complexity a reader can hold. */
function districtNode(id: string, selector: string, echo: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) return el;

  if (location.pathname !== "/") {
    location.href = `/#${encodeURIComponent(id)}`;
    return null;
  }

  emit(
    `<pre class="prose"><span class="warn">  no district "${esc(id)}". try: ls</span></pre>`,
    echo,
  );
  return null;
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
      // the listing numbers entries; the anchor there carries the real slug
      {
        // Escaped for the same reason cd is, though nothing unsafe can reach
        // here today: parse only produces logEntry after /^\d+$/, so `n` is
        // always a number. The guarantee lives in the parser, one file away —
        // and an unescaped interpolation beside an escaped one invites the
        // reader to conclude the difference is meaningful.
        const link = document.querySelector<HTMLAnchorElement>(
          `a[data-act="log"][data-id="${CSS.escape(String(action.n))}"]`,
        );
        if (link) {
          location.href = link.href;
          return;
        }
      }
      location.href = "/log";
      return;
    case "me":
      location.href = "/me";
      return;

    // The block is lifted out of the card rather than rebuilt here. Two
    // renderings of the same four groups is the drift this whole file exists to
    // prevent: these are literally the same nodes, so they cannot disagree.
    case "evidence": {
      const block = districtNode(action.id, `[data-evidence="${CSS.escape(action.id)}"]`, echo);
      if (!block) return;

      const copy = block.cloneNode(true) as HTMLElement;
      // the hook stays with the original: two nodes answering to the same
      // data-evidence would make `evidence aura` twice copy a copy
      delete copy.dataset.evidence;
      emit("", echo).replaceChildren(copy);
      return;
    }

    case "cd": {
      const summary = districtNode(
        action.id,
        `summary[data-act="cd"][data-id="${CSS.escape(action.id)}"]`,
        echo,
      );
      // districtNode has already answered when the summary is missing. A summary
      // outside a details cannot occur — the template authors one inside the
      // other — so there is nothing left to report here.
      const el = summary?.closest("details");
      if (!el) return;
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

    // Reached only from Escape, but it goes through here like everything else:
    // an Action the dispatcher does not know is a case that silently does
    // nothing the first time anyone routes it, and this file's whole claim is
    // that a click, a typed line and a key cannot drift apart.
    case "dismiss":
      for (const card of document.querySelectorAll<HTMLDetailsElement>("details.district[open]")) {
        card.open = false;
      }
      sink?.focus();
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

/** Typing should just work: the one instruction on screen says "click anything,
 *  or type", and without this only the first half was true.
 *
 *  The keystroke is applied here rather than left to the browser to redirect
 *  into the newly focused field. Focusing during keydown does carry printable
 *  characters across in current browsers, but it carries neither Backspace —
 *  whose default already ran against the old target — nor Enter, whose event
 *  was dispatched to the body and so never reaches the input's own listener.
 *  Both were verified swallowed. Doing the work explicitly makes all three
 *  behave the same and does not rest on behaviour I could not test. */
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const active = document.activeElement;
  if (active === sink) return;
  // a real control has focus and should keep it
  if (active instanceof HTMLElement && active.closest("a, button, summary, input")) return;

  const type = (next: string) => {
    e.preventDefault();
    sink.focus();
    sink.value = next;
    sink.dispatchEvent(new Event("input", { bubbles: true }));
  };

  if (e.key.length === 1) return type(sink.value + e.key);
  if (e.key === "Backspace") return type(sink.value.slice(0, -1));
  if (e.key === "Enter") {
    e.preventDefault();
    sink.focus();
    sink.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }
});

sink.focus();

/* Escape closes whatever is open and puts the caret back at the prompt. A
   reader who opened a card with the keyboard previously had no way back except
   cycling Tab through everything after it. Its own listener, because the typing
   redirect above returns early when a real control has focus — a summary is one
   — and would never see this key. The typed line is left alone: Escape is for
   getting out of a card, not for discarding work.

   isComposing is checked because an IME sends Escape to cancel a candidate
   window, and taking it there would discard what someone is in the middle of
   typing in Japanese or Chinese while a card sits open behind them. */
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;

  const action = actionFromKey(e.key);
  if (action?.kind !== "dismiss") return;

  const open = document.querySelectorAll<HTMLDetailsElement>("details.district[open]");
  if (!dismissApplies(document.activeElement, open.length)) return;

  e.preventDefault();
  dispatch(action, "");
});
