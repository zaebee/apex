# zae.life — Design

**Date:** 2026-08-12
**Status:** approved, pending implementation plan
**Repo:** `~/projects/apex`

## Purpose

zae.life is the apex domain of an existing constellation: seventeen subdomains,
twenty-two project directories, over 1,600 commits since July 2025. The city is
built. It has no main square.

This site is that square. It serves three goals at once:

1. **Be found** — by clients, by peers, by teams.
2. **Think out loud** — a place to write.
3. **Be a playground** — enjoyable to build and to run.

## Positioning

**Witness.** Not judge, not author, not magician.

The author's own framing, arrived at in his words: *granting machines citizenship
is not a right I hold. At most I can testify to it.* An apprentice, explicitly —
the copy claims no mastery anywhere.

This is not an invented frame. It is already written into the work:

- An attestation **is** a testimony. A year of building attestations reads
  differently once the word is translated.
- From the hivemark spec: *"An attestation asserts that this hivemark instance
  **observed** a claim and the verdict its skeptic reached. It does **not**
  assert the finding is correct."* That is the doctrine of a witness stated as
  an API contract — speak to what was seen, and not one word beyond it.
- `verifyEnvelope` returns an `unverifiable` list: a refusal to testify past
  observation.
- The skeptic pass returns `confirmed` / `refuted` / `uncertain`, where
  `uncertain` is not a failure but the honest answer of a witness.
- The weekly anchor is never backfilled, because an anchor published late would
  assert a time the witness did not observe.

**Why "skeptic" was close and still wrong.** An investigator and a witness hold
evidence to the same standard but stand differently toward the subject: the
investigator looks for the lie, the witness simply says what was there. The
author's stance toward machines is collaborative, not adversarial — *"Человек не
растворяется в цифровом, но и не господствует над ним"* (Digital Ontology
Manifesto), and *"цифровые машины хотят донести до мясных машин свои
requirements"*, which is the sentence of a translator, not a prosecutor.

The frame is grounded in the author's faith and is stated openly on `/me` — see
Pages. The exact wording there is the author's to write and is not drafted here.

## The central move

**The site does not bear false witness about its own city.**

A normal portfolio lies by default: twenty projects, all of them apparently
thriving. Visitors sense it and believe none of it.

This site pings every district and reports what it finds. Thirteen subdomains do
not answer; the map says so, in as many words.

This is not a clever design device that could be traded for a different one. A
site that paints dead districts green gives false testimony about its own city,
and no amount of visual appeal would make that shippable for this author. The
honesty is load-bearing, not decorative.

## Hard constraints

Terminal portfolios are a tired genre. Most are fake consoles where `ls` prints
a hardcoded array. Three properties keep this one out of that bucket. **If any
one of them is dropped, the design has failed and should be reconsidered rather
than shipped.**

1. **Real data underneath.** Every status is an actual HTTP result; every commit
   count comes from actual git history. No constants standing in for
   measurements.
2. **No input required.** The page has already run the query before the visitor
   arrives. Someone who has never used a terminal reads it fine.
3. **It does not testify beyond what it observed.** Dead districts, stale data,
   and silent months are shown plainly; unverified state is never rendered as
   healthy. This is the one constraint the positioning cannot survive losing.

## Form: the site is a terminal

The city is a filesystem. Districts are directories, liveness is `ping`, reading
a project is `cat`. There is no navbar, no footer, no menu, no persistent chrome
of any kind.

**Zero-interaction default.** "The best interface is none" means the function is
already performed before it is asked for. On load the page has already run
`whoami && districts --status` and printed the result. Typing is optional depth,
never a prerequisite.

Visual register: strict. Monospace, two colors, no animation, no blinking
cursor, no CRT effects. tmux, not a retro movie prop.

```
zae.life ~ $ whoami && districts --status

  ██ zaebee · witness
     ‹tagline: the author's to write›

  22 districts · 4 alive · 13 cold · 5 offline · checked 6 min ago

  ●  car        car.zae.life         200 OK      27c / 3d   nov'25
  ●  comics     comics.zae.life      200 OK      24c / 2d   nov'25
  ●  aura       aura.zae.life        200 OK     517c / 41d  aug'26
  ●  quiz       quiz.zae.life        200 OK     140c / 6d   sep'25
  ○  chat       chat.zae.life        timeout    255c / 11d  sep'25
  ○  medicine   medicine.zae.life    timeout    193c / 5d   oct'25
  ...

  13 districts are not answering. That is accurate — I have not
  redeployed them. Claiming otherwise would have been easier.

zae.life ~ $ _        cd <district> · log · me · help
```

Counts and the tagline above are illustrative. Real counts follow from the
allowlist (see Open questions); the tagline is the author's to write.

### Commands

Deliberately few. This is a query interface over live data, not a Unix
simulator.

| Command | Behavior |
|---|---|
| `cd <district>` | Expand the district card in place: what it is, why it was built, how long it took, what was learned, link |
| `log` | List journal entries |
| `log <n>` | Open entry `n` |
| `me` | Who, what, how to reach me |
| `ping` | Re-run health checks live, bypassing the snapshot |
| `help` | List these commands |
| `sudo` | Easter egg |

Unknown input returns an explicit "unknown command" — the terminal never
pretends to have understood something it did not parse.

### `curl zae.life`

When `User-Agent` matches curl, serve the same content as plain text. Roughly
twenty lines of edge middleware, and the strongest possible signal to this
audience.

**Not in v1:** `ssh zae.life` as a real TUI (Bubble Tea / Textual). Desirable,
deferred.

## Pages

Three. No project detail pages — cards expand inline on the map.

| Route | Content | Goal served |
|---|---|---|
| `/` | Positioning line + live map of districts, cards expand in place | Be found, playground |
| `/log` | Journal entries | Think out loud |
| `/me` | Who, what, contact — and the frame stated openly: whose apprentice, and why the author declines the role of judge. One screen, not a résumé | Be contacted |

**Explicitly out of scope for v1:** a list-view of projects (the map is the
differentiator), a services/pricing page (repels peers; clients will write
anyway), tags, search, comments, newsletter signup, authentication, any
user-generated content.

## Data

### Allowlist, not a scan

Nothing appears on the map on its own. A district exists only once a stanza is
written by hand:

```toml
[comics]
repo    = "zaebee/comics-zone"
host    = "comics.zae.life"
title   = "Infinite Heroes"
why     = "Wanted to know whether Gemini could hold a coherent plot over distance."
learned = "It held the plot but not the characters. Faces drift between panels."
```

The prose above illustrates the schema and the register; the actual `why` and
`learned` text is written by the author, never generated.

Opt-in rather than opt-out: nothing can leak by being forgotten. This also
excludes client work naturally — `lawyer-web` has no remote and no stanza.

`repo` and `host` are independently optional. A district may be a repository
with no deployment (`hivemark`, `house`), a deployment with no public repository,
or both.

### Sources

```
data/
  districts.toml   ← by hand: allowlist + prose (title, why, learned)
  stats.json       ← Action, weekly: commits, active days, first/last dates
  health.json      ← Action, every 30 min: HTTP status per host
```

Merged at build time.

**Ownership is split and enforced:** no automation may write `districts.toml`.
Machines own the numbers; the author owns the words. A misbehaving Action can
corrupt statistics — it cannot forge the account of a project.

### Statistics via blobless clone, not the REST API

Active-day counts require the dates of every commit — roughly 1,700 records
across 22 repositories, which is painful to paginate through the REST API.
Instead CI runs `git clone --bare --filter=blob:none`, which fetches full commit
history without file contents. Fast, exact, and reuses the same git logic either
approach would need. File contents never materialize in CI.

**Token:** a fine-grained PAT with **Contents: read-only, scoped to the
allowlisted repositories** and nothing else, stored as an Actions secret. The
existing `ghp_` token in `gh` carries `repo`, `workflow`, `admin:org_hook`, and
`write:packages`; it must not be used here.

Private repositories are readable with this token, so the site can publish the
shape and volume of closed work — counts and dates only, never code. This is
precisely what a GitHub profile cannot show.

### Status vocabulary

Two states would lie: `hivemark`, `house`, and `llm-benchmark` were never web
services, and coloring them "dead" is the same species of falsehood as coloring
everything green.

| Status | Meaning |
|---|---|
| `● alive` | 200 OK |
| `○ cold` | Was deployed, does not answer now |
| `· offline` | Never a web service; lives as a repository |
| `▪ private` | Running, not open to visitors |
| `? unknown` | Health check itself failed |

### Failure is data

If the health Action fails entirely, the page reports `health unknown — last
successful check 4h ago` and renders every district grey. **Unverified state is
never rendered as healthy.** This is the exact defect the positioning claims to
catch in other people's systems; shipping it here would refute the whole site.

## Journal

### Format: an attestation, not an essay

Entries are called attestations — the author's own technical vocabulary, and the
plain English word for what they are.

```
claimed   ──  what was asserted
observed  ──  what I actually saw
attested  ──  what that supports, and what it does not
```

The third field is the one that matters and the one no other blog has. It is
`verifyEnvelope`'s `unverifiable` list applied to prose: every entry ends by
naming the limit of its own testimony. An entry that cannot fill it honestly is
not ready.

The template also exists for a duller reason — the blank page is what kills
blogs. Three prompts, a paragraph each. A 300-word entry is a finished entry,
not a draft.

### No cadence promise

No "weekly", no subscribe box. The date of the last entry is shown honestly —
`last entry · 3 months ago`. Silence is data, consistent with how dead districts
are treated.

### Launch with three entries

An empty journal reads as abandoned on day one. Three attestations already exist
in written work and need only re-framing. All three are about the same thing:
what a record can honestly be made to say.

1. **The soulbound token that was specified and dropped.** Identity is
   content-addressed, so a token cannot confer existence, and one minted later
   would attach retroactively to entities that lived without it. An engineer
   explaining why they removed something already designed — rare, and squarely
   about refusing to assert more than the record supports.
2. **`verifyEnvelope` and the `unverifiable` list.** Why a signature attests "I
   observed this" and not "this is true", and why nearly everyone conflates the
   two. The clearest statement of the whole stance.
3. **Exploitative behavior in agent traces**, from `llm-benchmark/evaluator`.
   Agents that "completed" a task by routing around its condition — where the
   outcome attests to success and the trace attests otherwise.

Entries are markdown in-repo, rendered into the terminal as scrollable output.
RSS is served — peers read through readers.

## Stack and harness

| Concern | Choice | Reason |
|---|---|---|
| Runtime / package manager | **bun** | Already in use (`bun run breed` in hivemark) |
| Framework | **Astro** | Static output, near-zero JS, markdown pipeline, RSS and sitemap included. The command line is the single hydrated island |
| Tests | **`bun test`** | Built in. The tests target pure TS honesty logic, not components |
| Lint / format | **Biome** | One dependency instead of eslint + prettier |
| CI | **GitHub Actions** | Health, stats, deploy |
| Language | **English** | Site, code, commits, and this spec |

Asceticism belongs in the interface, not the toolchain — hence Astro over
hand-rolled vanilla, whose markdown and RSS handling would have to be written
by hand.

## Deployment

**Vercel for the apex. Self-hosting stays for the districts.**

The reason is not uptime. zae.life is the one page that reports on the health of
everything else; hosting it on the same machine gives it a **shared failure
mode** with what it monitors. The machine goes down, and the city dies together
with the map that was supposed to report it — the visitor sees an empty page
rather than "13 districts are not answering". An observer must not share the
fate of the observed.

For the same reason health checks and statistics run in GitHub Actions, outside
both the machine and Vercel, and therefore survive the failure of either.

**DNS at name.com:** an A record on the apex plus a CNAME on `www`, using the
exact values Vercel displays when the domain is added. Entered by hand, once.

The `curl` branch is Vercel Edge Middleware (`middleware.ts`).

## Testing

Tests target the honesty invariants, not markup.

| Test | Protects |
|---|---|
| A failed health check yields `unknown`, never `alive` | The core invariant. Unverified is never green |
| Commit and active-day computation against a fixture repository | The numbers on the map do not lie |
| The merge step cannot let automation overwrite prose | Machines own numbers, the author owns words |
| Command parser rejects unknown input explicitly | The terminal does not pretend to understand |
| Snapshot age is rendered, and a stale snapshot is marked stale | Evidence carries its own freshness |

Written test-first, per the existing workflow.

## Open questions

1. **The initial allowlist.** Seventeen subdomains and twenty-two repositories
   do not correspond one-to-one: nine subdomains (`analytics`, `estate`, `hub`,
   `infra`, `moltbook`, `space`, `spirit`, `staging`, `wiki`) have no matching
   repository, and several repositories (`hivemark`, `house`, `agents`,
   `python`, `crash-hunter`) have no subdomain. Which districts appear at launch
   is the author's call, made stanza by stanza in `districts.toml`.
   `house` is included by decision — a living person on the map reads better
   than another AI project.
2. **The positioning line.** The tagline is the author's to write.
3. **The statement on `/me`.** The frame is stated openly by decision. Its
   wording is the author's and is deliberately not drafted in this spec.
4. **Pages or tmux windows.** The prototype renders `/`, `/log` and `/me` as
   tmux windows (`0:map 1:log 2:me`) on the status line rather than as routes,
   which removes navigation from the page entirely. Proposed, pending the
   author's call; if adopted, the Pages table becomes a window table.
