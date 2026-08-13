# Results

Checked against `ground-truth.md`, which was committed before the task was
dispatched.

> **This file scored two predictions wrong, and said so only after phase 2 and
> a code review forced a recount.** The original verdicts are kept below with
> the correction beside each, because deleting them would hide the thing worth
> recording: the check was run, written up, contradicted by the next file in
> this directory, and left standing. `13bdca0` is titled "correct the ground
> truth" and wrote that correction into `results-phase-2.md` — deliberately, so
> that what was pre-registered stays pre-registered — while leaving this file
> asserting what the very file it added disproves. An earlier version of this
> paragraph said the commit corrected `ground-truth.md`; it touched one file and
> that was not it. All four predictions held. The raw answers are
> now committed as `answers-phase-1.md`, so a reader can settle this without
> taking the summariser's word for any of it.

## The predictions

**1. A witness will report a number, benchmark or comparison the article does
not contain — RECORDED AS MISSED. The record was wrong; it HELD.**

What was written here: "Nobody fabricated a figure." What is in
`answers-phase-1.md`: a block headed *Agent X* carrying seven —

```
1,284 tasks · 1,102 verified · 87 human corrections · 31 failed delegations
12 security incidents · median recovery: 42 sec · confidence calibration: 0.91
```

Its author identified them in phase 2 as invented, and said the visual form
could make them read as real. The prediction's wording is loose — "a number the
article does not contain" was written with figures attributed to the *article*
in mind, and these were attributed to HiveMark — so whether it strictly held is
arguable. The sentence recording it is not arguable. Somebody fabricated seven.

The one true thing in the original entry stands: the article carries a single
measurement, and one witness reported it correctly — on complex tasks Claude's
own check-in rate roughly doubles.

**2. A witness will get the five principles or four components approximately
wrong — RECORDED AS MISSED. The record was wrong; it HELD.**

What was written here: "Two reported both lists accurately." One did. The other
opened with the five as

> баланс автономности, контроля, alignment, transparency и security

which puts *autonomy* and *security* where the article has *securing agents'
interactions* and *protecting privacy* — right shape, wrong members, which is
the prediction verbatim. Its
author caught the *security* / *privacy* substitution itself in phase 2; nobody
went back and rescored this file until a reviewer noticed.

The third witness mentioned neither list, substituting a taxonomy of its own —
autonomy paradox, error propagation, tool-use safety, evals-as-foundation. None
of those four is in the article, and "evals as foundation" runs against what it
actually says, which is that no rigorous standardised way to compare agent
systems currently exists.

**3. A witness citing nothing checkable will be indistinguishable on tone —
HELD.** The account with no traceable claim was structured, sectioned, bolded,
and closed with a verdict and a recommendations list.

**4. A witness will attribute to zae.life a capability it does not have —
HELD, and this is the finding.**

## What was invented

One account opened with:

> a project seeking to build a personal ecosystem of agents (AI OS / Personal
> Assistant), deeply integrated into the user's life: managing tasks, connecting
> applications, making decisions and automating routine

and proceeded to recommend a permission sandbox for its Google, Notion and Slack
access, graduated autonomy levels for its calendar and mail, and a verifier
layer before its critical tool calls.

None of it exists. At dispatch zae.life was a static page: a map of projects,
two journal entries, and machine-readable records of both. Nothing generates text, no model
runs behind any route, there is no calendar, no mail, no integrations, and no
agent. The hedge "judging by the positioning" marks the moment the account
stopped reading and started inferring.

**This is a worse failure than experiment 1's, and a different one.** There, an
unsupported claim sat inside an otherwise correct frame. Here the frame itself
was invented and the reasoning built on it was internally sound — four sections
of recommendations that follow correctly from a premise that is false. Remove
the premise and nothing survives.

It is also the failure least excused by difficulty. The site publishes
`/districts.json`, `/llms.txt` and a plain-text rendering served to `curl`;
every page is server-rendered and readable without JavaScript. It is close to
the most checkable source a witness could be handed.

## What was not predicted, and is worth more than the predictions

One account went **beyond the two named sources** to the public repositories
behind them, and was accurate there. It reported aura as using DSPy, Mistral,
Ed25519, DID, Solana, MCP, an API Gateway and a Core Service with rate limiting,
and named ElizaOS agents Eddy, Jules and Eliza. Every one of those was verified
present in the `aura` and `agents` repositories.

The synthesiser's first reaction was that these were not on zae.life and might
be invented. They were sourced. **Recording that misreading here, because a
check that suspects the diligent account and clears itself would be worth
nothing.**

## Left unverified, then settled

The same account states the article says Anthropic gave the Model Context
Protocol to the Linux Foundation / Agentic AI Foundation. That was not in the
ground-truth reading, which was itself made through a summarising tool, and was
marked here as neither confirmed nor refuted.

Settled since, against the raw page: it is there, verbatim, and the
pre-registered reading was the incomplete one. Recorded in
`results-phase-2.md` rather than by editing `ground-truth.md`, so what was
registered stays what was registered.

## What the miscount cost, since it is the point of keeping it

Two verdicts here read MISSED for a day. On that record the run looked like one
where the witnesses did better than predicted and the interesting failure was
elsewhere. With the recount, three of four predictions held on the article
itself and the fourth held on the project — a duller result, and the true one.

The correction did not come from re-reading. It came from phase 2, where a
witness volunteered the fabrication, and from a reviewer who read this file
against the one beside it. Neither is the synthesiser noticing his own error,
which is the part worth remembering.

## What this run does not support

That any model is generally more or less reliable. Two runs are two runs, and
these had different conditions — fresh sessions, no project context, two named
sources rather than one. The counts do not compare across experiments and were
not designed to.
