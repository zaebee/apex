# zae.life

A map of the projects I have built, reported as they actually are, served as a
strict terminal at [zae.life](https://zae.life).

Most personal sites list work in the present tense forever. This one probes its
own districts on a schedule and says what came back — including that six of the
eight with a host are not answering, and that the record of how long only starts
when the site began watching.

```
zae.life ~ $ whoami && districts --status

  zaebee · witness, apprentice

  12 districts · 2 alive · 6 cold · 4 offline
  snapshot · just now
  ● answering now    ○ was deployed, silent now    · never a web service

  ○  aura         aura.zae.life         bad gateway 517c / 41d aug'26
                  no answer in 22 checks since 13 Aug
  ●  grani        grani.zae.life        200 OK      477c / 30d aug'26
                  Грани Памяти — a Telegram WebApp game.
```

`curl zae.life` gets the same map as plain text. Every page renders server-side
and works without JavaScript.

## The one rule

**The site does not bear false witness about its own city.** A published claim
that outruns its evidence is a defect of the same severity as a crash, and is
fixed the same way.

Most of the design follows from that.

### Five states, and the difference between two of them

| | |
|---|---|
| `alive` | probed, and it answered |
| `cold` | probed, and it did not answer |
| `offline` | never a web service — no host to probe |
| `private` | deliberately not public |
| `unknown` | **not observed** — the check failed, or something else answered |

`cold` is a fact about a district. `unknown` is a fact about the observation.
Collapsing them would let a broken checker paint a healthy city red, or a
lapsed domain landing on a registrar's parking page paint a dead one green.
Amber is reserved for `unknown` and never spent on `cold`.

Two consequences worth knowing:

- **Comparisons are by value, never by truthiness.** A corrupted `health.json`
  once rendered every district alive, because the string `"false"` is truthy.
- **A probe that lands on another host is `unknown`, not `alive`.** Answering is
  not the same as being the thing that answered.

### Four kinds of knowing, kept apart

The card behind each district names where every line came from:

```
zae.life ~ $ evidence aura

    observed    health.json · checked 12 min ago
      host      aura.zae.life
      answered  bad gateway · 502
    recorded    history.json
      watched   no answer in 22 checks since 13 Aug
    derived     stats.json · read 1d ago
      built     517 commits across 41 active days, last 2026-08-13
    authored    districts.toml
      what      Agent negotiation infrastructure
      why       ‹ not written yet ›
```

Each group states freshness in its own vocabulary, or states none. A probe's age
erodes what it claims, so it says `checked`. Git history does not erode — a count
read last week is still a true account of commits that happened — so it says
`read`. Authored prose has no freshness and is given none.

A group with nothing in it is absent rather than empty, because a heading over
nothing claims a check happened.

## Who wrote what

Machines own the numbers. The author owns the words.

`health.json`, `history.json` and `stats.json` are written by workflows and never
by hand. The `what`, `why` and `learned` fields, the tagline and the text on
`/me` are written by me and never generated — which is why several of them read
`‹ not written yet ›` instead of something plausible.

The separation is enforced at the merge, with a test that feeds a statistics file
carrying prose and asserts none of it reaches the page.

## The journal

`/log` holds attestations. Each one has three fields — `claimed`, `observed`,
`attested` — and the third names the limit of its own testimony. An entry that
cannot fill it honestly is not ready, and the build says so rather than
publishing a claim with no boundary.

They are mostly records of being wrong. So far: agreement concealing that a
witness never opened the source; a correction introducing two false claims while
removing one unsupported one; a request for citations producing citations; and
three reviews approving a change whose defects were in the lines they praised.

## Running it

```sh
bun install
bun run dev        # astro dev
bun test           # 206 tests
bun run lint       # biome
bun run typecheck  # astro check && tsc --noEmit
bun run build
```

Data producers, normally run by workflows rather than by hand:

```sh
bun run scan       # git statistics, via a blobless clone
bun run health     # probe every host, write data/health.json
bun run history    # fold the snapshot into data/history.json
bun run provenance <answer.md> <name>=<source.txt>
```

That last one is a checker for quoted claims: it reports which quoted fragments
appear in the files it was handed and settles nothing else. It came out of the
experiments in `experiments/`, and its own blind spot is written at the top of
`src/lib/provenance.ts`.

### Stack

Astro 7 (static, with one non-prerendered route), bun, Biome, TypeScript, Vercel.
GitHub Actions probes health and reads statistics weekly; both commit their
output, which is what keeps the timestamps on the page true.

The health workflow asks for every 30 minutes. Measured over its first 23 runs it
delivered a median of 62 minutes apart — GitHub drops scheduled jobs under load,
and `*/30` fires on the hour, which its own documentation names as the worst
window. The record cannot currently say how many runs were intended, which is
[issue #38](https://github.com/zaebee/apex/issues/38).

### Machine-readable

`/districts.json` · `/health.json` · `/history.json` · `/llms.txt` · `/rss.xml` ·
`/robots.txt`, and the plain-text map served to `curl`.

There is deliberately no agent card and no AI feature. Nothing on this site
generates text.

## Licence

Code is MIT — see [`LICENSE`](LICENSE).

The writing is licensed separately, and the raw model answers in `experiments/`
are not mine to license at all — see [`LICENSE-CONTENT`](LICENSE-CONTENT).
