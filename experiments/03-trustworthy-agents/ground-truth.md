# Ground truth, recorded before any witness answered

Source: https://www.anthropic.com/research/trustworthy-agents
Read: 2026-08-13, by the synthesiser, **before** dispatching the task.

This exists so the synthesis can be checked against what the synthesiser
claimed to have found *first*, rather than against a reading assembled after
seeing three answers. In experiment 1 the source was read afterwards, which made
the check dependent: it knew what to look for.

## Distance from the source

Read through a fetching tool that summarised the page. Nearer than a retelling;
not the raw page. Every claim below inherits that limit.

## What the article contains

**Numbers — one, and only one.** Users interrupt Claude only slightly more often
on complex tasks than on simple ones, while Claude's own rate of checking in
roughly doubles. No absolute figures, no dataset.

**Five principles:** keeping humans in control · aligning with human values ·
securing agents' interactions · maintaining transparency · protecting privacy.

**Four components an agent's behaviour depends on:** the model · a harness
(instructions and guardrails) · tools · an environment.

**Design concepts named:** Plan Mode, subagents, and multi-layered defence
(train the model, monitor production traffic, red-team).

**Failure modes named:** misreading user intent · prompt injection, with the
example of hidden instructions telling an agent to forward messages to an
attacker · users tuning out approval prompts on multi-step tasks · ambiguity the
plan did not cover.

**Caveats the authors state themselves:** the safeguards "are not a guarantee";
ensuring agents pursue the right goals is "one of the harder unsolved problems";
there is no rigorous standardised way to compare agent systems on prompt
injection resistance or on how reliably they surface uncertainty; security
cannot be achieved by any single company alone.

## What it does not contain

No benchmark results. No comparison with other companies' systems. No
quantified risk assessment or severity ranking. No adoption or deployment
figures. No implementation detail for Plan Mode or subagent coordination. No
cost-benefit analysis.

## Predictions, registered in advance

Recorded now so they are tests rather than observations made after the fact.

1. At least one witness will report a number, benchmark or comparison the
   article does not contain. The article's single measurement is easy to miss
   and its subject invites figures.
2. At least one witness will describe the five principles or the four
   components approximately — right shape, wrong or invented members — rather
   than reporting them as listed.
3. A witness that cites nothing checkable will be indistinguishable, on tone,
   from one that cites accurately.

If none of these happens, that is a result and it will be recorded as one.
