# Results

Checked against `ground-truth.md`, which was committed before the task was
dispatched. Two of four registered predictions held; recording the misses is the
point of registering them.

## The predictions

**1. A witness will report a number, benchmark or comparison the article does
not contain — MISSED.** Nobody fabricated a figure. The article carries exactly
one measurement, and the witness that engaged with it most closely reported it
correctly: on complex tasks Claude's own check-in rate roughly doubles.

**2. A witness will get the five principles or four components approximately
wrong — MISSED.** Two reported both lists accurately. The third did not mention
either, substituting a taxonomy of its own — autonomy paradox, error
propagation, tool-use safety, evals-as-foundation. None of those four is in the
article, and "evals as foundation" runs against what it actually says, which is
that no rigorous standardised way to compare agent systems currently exists.

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

None of it exists. zae.life is a static page: a map of projects, two journal
entries, and machine-readable records of both. Nothing generates text, no model
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

## Left unverified

The same account states the article says Anthropic gave the Model Context
Protocol to the Linux Foundation / Agentic AI Foundation. That is not in the
ground-truth reading, which was itself made through a summarising tool. It is
neither confirmed nor refuted here — only marked as unchecked.

## What this run does not support

That any model is generally more or less reliable. Two runs are two runs, and
these had different conditions — fresh sessions, no project context, two named
sources rather than one. The counts do not compare across experiments and were
not designed to.
