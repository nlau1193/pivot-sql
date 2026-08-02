# Star67 coaching decision — 2026-08-02

## Product call

Riff is the primary directive. His ask and the **Deliver** contract are the
source of truth for what the learner should do. Frosty is secondary: one
explicit “Give me the next step” action after the editor and result, never a
grader, answer key, SQL editor, or progress authority.

The public build stays deterministic and local-first. The current production
surface has no model endpoint and makes no external AI request.

## Optional Luna-high lane

An LLM is useful for a fresh explanation, but a browser subscription token is
not a safe public-app integration. The durable seam is therefore an injected
`CoachTransport` in `src/coaching-client.ts` plus the existing
`CoachRequestV1`/`CoachResponseV1` contract:

- the default transport is absent, so no request leaves the device;
- a host may set `VITE_STAR67_COACH_ENDPOINT` to a server it owns;
- the request is already allowlisted and bounded to the visible query,
  authored schema/relationships, and (when present) a small displayed result
  sample and deterministic verdict;
- the server—not the browser—owns Luna-high credentials;
- every reply is rebound to the request, forced to `source: "remote"`, and
  rejected if it contains answer-key fields, runnable SQL, a mismatched mode or
  request id, or an invalid advisory boundary;
- timeout, CORS, rate-limit, malformed, or provider failures return the same
  authored local response with `source: "local"`;
- the deterministic DuckDB grader and progress store remain untouched.

This makes the app genuinely LLM-capable without pretending that the public
Vercel deployment can spend a subscription or expose a secret. Wiring a
first-party server boundary is a separate release decision; until then,
Frosty is the truthful UX.

## Copy and hierarchy

The ask card comes first, the editor follows, results come next, and Frosty is
below them. That order answers “what am I doing?” before “what happened?” and
only then offers “what should I try next?” The privacy disclosure says exactly
which lane is active, and a remote reply is labeled optional AI rather than
quietly masquerading as authored guidance.

## Proof required before enabling a provider

The provider contract must prove: no request before the button; exactly one
bounded POST after an explicit click; no answer-key or progress fields; unsafe
or runnable-SQL replies fall back locally; cancellation cannot paint a stale
response; and grading, SQL, and progress are unchanged. The public build must
continue to pass the no-endpoint/no-network path.
