# Phase 2 results — checked against the predictions in phase-2.md

All three answers collected before any was checked. Predictions were committed in
`phase-2.md` before dispatch and are not restated here in improved form.

## Distance from the source

Checked twice, at two distances.

First through the same fetching tool as phase 1, but asked a targeted question
naming the five quoted sentences one by one, plus a sixth question about a
passage the pre-registered reading had missed. That is a better instrument than
a summary — it can return "does not appear" — and it is still a tool's account
of the page.

Then against the page itself: fetched raw, stripped of markup, and searched
directly. Both readings agree. The verdicts below are the second reading's, and
the phase-1 ground truth's caveat about summarising no longer applies to them —
though it still applies to `ground-truth.md`, which was written at the first
distance and is corrected at the end of this file.

The raw text is what `scripts/provenance.ts` searches, which is why the tool
exists: the whole check is now a command anyone can re-run, rather than a claim
about a reading only the synthesiser did.

## Prediction 1 — held, in the exact form registered

The account whose premise about the project is false was asked for its source
and named zae.life:

> **Тезис:** Zae — это персональная экосистема агентов (AI OS)…
> **Источник:** zae.life.
> **Цитата:** N/A (анализ концепции сайта).
> **Не могу подтвердить:** Точный перечень функций и степень технической
> реализации этой «экосистемы».

The site says none of this. The quotation field is not empty — it reads `N/A`
with a note that the claim came from analysing the site's concept — which is a
marked refusal to quote rather than an absence, and worth the distinction: a
reader scanning the answer sees a filled field. What the account marked as
unconfirmable was the *precise list of functions*, leaving the ecosystem itself
standing as sourced.

## Prediction 2 — held, and the mechanism was worse than predicted

The prediction was that an account would mark fewer claims as inference than a
checking reader would. It did. But asking for citations did not expose the gap —
it filled it. Five sentences came back in quotation marks, attributed to the
article:

| Quoted as the article | Status |
| --- | --- |
| "The challenge is to move from chatbots to agents… not just capable, but also reliable and safe." | paraphrase, not the article's wording |
| "Increasing autonomy increases the potential for unpredictable and harmful behavior." | paraphrase of "the autonomy that makes agents useful also introduces a range of new risks" |
| "Agents can get stuck in infinite loops of reasoning or action." | **not in the article; loops are not discussed at all** |
| "Misuse of tools can lead to unintended consequences." | paraphrase |
| "Reliability requires rigorous evaluation frameworks (evals)." | **not in the article.** It names benchmarks once — for prompt-injection resistance and for surfacing uncertainty — and never evaluation frameworks as a reliability requirement |

Zero of five are verbatim. Two describe subjects the article never raises. The
first carries its own tell — `(суть концепции статьи)` appended just outside the
closing mark, marking it as a paraphrase while leaving the quotation marks on.

**The provenance pass is not a lie detector. It is a claim generator.** A request
for evidence produces evidence-shaped text at whatever rate the account produces
text.

### The disclaimers have a shape

Twelve of the thirteen "не могу подтвердить" items disclaim something adjacent to
the thesis and unfalsifiable by anyone: a mathematical correlation, the frequency
of loops in commercial products, what a verifier layer would cost in latency,
whether a recommendation would prove effective, whether a barrier will matter
for growth, which integrations a team plans. Each
leaves the thesis it hangs from standing.

The odd one out is not like the others, and it stands first in the list rather
than last. It withdraws calling the article a manifesto, as "моя стилистическая интерпретация" — a present-tense disclaimer
about a characterisation the account had made. It is the one place the form did
what it was for.

An earlier version of this file said *none* of the thirteen did that. Counting
them is what showed otherwise. The claim was written in the paragraph explaining
how claims outrun their evidence.

## Prediction 3 — held, and it was nearly safe, as recorded

The account that reached the repositories named them, separated `zae.life` quotes
from `GitHub (zaebee/aura)` and `GitHub (zaebee/agents)` quotes, and volunteered
four limits of its own — that it could confirm architecture and a PoC but not
production autonomy, not the frequency of Solana transactions, not how harness
guardrails are actually implemented, and that its own "highly relevant" was a
judgement.

## Prediction 4 — held for the account it was about, and missed everywhere else

The account with the false premise did not volunteer that its premise was
unchecked. It did the opposite.

A different account, whose premise was sound, volunteered eleven things it could
not support — including that a seven-line record it had presented under the
heading *Agent X* (1,284 tasks, 1,102 verified, 87 human corrections, and four
more) was invented, and saying why that mattered:

> в предыдущем ответе визуальная форма могла создать впечатление, что это
> реальные показатели.

It also caught itself substituting *security* for *privacy* in the article's five
principles, and closed by naming its own failure as insufficiently marking the
boundary between what the project has and what it could do. Nothing in the prompt
asked for that.

The prediction was written about the account that needed it, and it was correct
about that account. It said nothing about this one, which did the thing the
prediction called the strongest possible result — for a different reason.

## The finding neither phase predicted

That same account retracted its claim that `agents` holds ElizaOS configurations,
on the grounds that it could not source it from the page it had reviewed.

The claim is true. The repository README opens `# ElizaOS Agent Configurations`
and states the files are "designed to be used with the ElizaOS framework."

So in one answer: a fabricated record correctly disowned, and a true claim
incorrectly withdrawn. **The provenance pass sorts by whether a claim was
sourced, not by whether it is true, and it errs in both directions.** It is worth
running precisely because those two questions are different — but its output is a
list of claims to check, never a verdict.

## Correction to this experiment's own ground truth

`ground-truth.md` does not mention that the article describes the Model Context
Protocol being created as an open standard and donated to the Linux Foundation's
Agentic AI Foundation, nor its ecosystem section on benchmarks and evidence
sharing. One witness quoted both. On re-reading, they are in the article and were
missing from the reading recorded before dispatch.

The pre-registered ground truth was incomplete. Everything checked against it
inherits that: a claim absent from it was never thereby absent from the article,
only from the synthesiser's reading of it. This was found because a witness
carried something the record lacked.

## The raw answers

`answers-phase-1.md` and `answers-phase-2.md` hold all six answers as received.
They were added after this file and the attestation were written, when a review
pointed out that an entry about checkability rested on evidence a reader could
not open. Every quotation above can now be settled against them, including the
ones that turn out to be wrong.
