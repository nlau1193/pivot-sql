# One next step: Pivot coaching decision

Status: implemented locally in the public release pass on 2026-08-01.

## The call

Pivot has one visible hint action: **Give me the next step**. It is not a
second grader and it is not a menu of five kinds of advice. Frosty chooses the
smallest useful coaching mode from the evidence already on screen:

| What the learner has done | What Frosty does | Why |
| --- | --- | --- |
| No run yet, or the draft changed after a run | Make a short plan from the ask and visible schema | The learner needs orientation, not a verdict |
| The engine returned an error | Explain the error boundary | The error is the most specific evidence available |
| A current result is on screen | Review that bounded result and the deterministic verdict | The advice can use the actual result shape without receiving the answer key |

The button label stays stable. Its supporting sentence tells the learner what
will happen, and the response names its evidence. Schema browsing, the
relationship canvas, and query rehearsal remain useful work surfaces, but they
are no longer presented as competing hint buttons.

## What is actually running

The public build runs authored, deterministic guidance in the browser. There is
no LLM inference, Vercel function, API key, account, or paid provider in this
path. `requestCoach` validates a versioned, answer-key-free request and calls
`createLocalCoachResponse`; `source: local` is the receipt. The response cannot
run SQL, grade work, mutate progress, or return a runnable solution.

The response contract keeps `source: remote` reserved for a future provider,
but no remote provider is wired. A future cloud option must sit behind the same
contract, be explicit opt-in, keep credentials server-side, and preserve the
local fallback. It is deliberately not part of Nicole's install or this
release.

## Ten concrete moments we test

1. Empty editor → plan the deliverable, grain, boundary, and first table.
2. A draft with no `FROM` → choose a source whose grain matches the ask.
3. A draft with a join missing → inspect the authored key before joining.
4. An aggregate without `GROUP BY` → decide total versus grouped rows.
5. A grouped query → compare every selected field with the intended grain.
6. Parser error → inspect the token immediately before the parser boundary.
7. Missing column → use the visible schema instead of guessing a field name.
8. Incorrect or close verdict → trace population, grain, ordering, and scope.
9. Correct current result → rehearse the business conclusion, evidence, caveat,
   and action.
10. An exploratory result with no authored verdict → review only visible
    evidence and stay explicitly uncertain.

These are product examples, not claims that a model inferred anything. The
deterministic engine remains the authority for correctness.

## Cut list

The old progressive hint ladder and Frosty's four quick-action buttons created
several overlapping ways to ask for help. They are removed from the learner
surface in this pass. The authored mission hint and solution fields remain in
the content contract for deterministic migration and auditability; they are
not silently exposed by the new single action.
