# Quality audit — 2026-08-01

This public audit records the bounded takeover pass for Pivot. The product call
is documented in [`COACHING_DECISION_2026-08-01.md`](COACHING_DECISION_2026-08-01.md):
one adaptive next-step action, deterministic and browser-local today.

## Fixed in this pass

1. **The learner-facing coaching ladder was noisy.** Frosty now exposes one
   “Give me the next step” button; evidence routes it to a nudge, error
   explanation, verdict explanation, rehearsal, or current-attempt review.
2. **The old controls implied several competing products.** Schema,
   Relationships, Rehearse, and Review remain useful work surfaces or internal
   contract modes, but are not parallel coaching CTAs.
3. **Coaching source copy was ambiguous.** The panel says built-in and private,
   and the public client has no fetch/API route or account requirement.
4. **Coaching could be mistaken for grading.** The UI and contract keep the
   warehouse checker as the only grading authority and forbid answer-key and
   progress mutation.
5. **The public build requested a missing favicon.** A tracked local SVG now
   removes the `/favicon.ico` 404.
6. **Small helper copy was hard to read.** Body, schema, editor, and coaching
   typography were raised together instead of selectively enlarging one label.
7. **Smoke coverage still asserted the retired hint ladder.** The browser
   proof now checks one action, ten routing examples, no `/api/coach` request in
   the local build, private source copy, unchanged graded evidence, and
   keyboard focus restoration after a response. The full local run is
   **174/174 steps green**.
8. **The README had no working desk capture.** Desktop and phone screenshots
   now show the real local app and the current coaching surface; a clean Chrome
   Guest Computer Use pass is also saved as
   [`pivot-computer-desk.png`](pivot-computer-desk.png).

## Reproduced or source-backed follow-up inventory

9. CI currently builds and runs contract suites but does not install a browser
   and run the full smoke path on every pull request.
10. The generated warehouse is a large first-use download; every fresh browser
    profile pays the cold-load cost.
11. Data generation writes directly to its target artifacts; an interrupted
    generator could leave a partial set for a reader without a lock/manifest
    transaction.
12. The generator has deterministic hashes and invariants, but no published
    checksum file for every parquet artifact.
13. A late `runDisplay` promise can race a mission switch; the current smoke
    proof covers one overlapping-mission path, not every abort boundary.
14. A pre-aborted coaching signal is checked, but a caller must still discard
    stale UI responses; the panel does so with sequence and abort guards.
15. Raw SQL execution remains intentionally bounded by the browser worker, but
    the debug `window.__engine` hook is a powerful test surface and must not be
    treated as an end-user API.
16. Progress export is a portable code, not an encrypted backup; users should
    treat it like local data and avoid posting it publicly.
17. Clipboard fallback and the paste flow depend on browser permissions; the
    app reports failure instead of silently claiming a copy succeeded.
18. A few relationship cards still need stronger per-field semantics for
    screen-reader navigation; the relationship work surface itself remains
    usable at 320–1,440 CSS pixels.
19. The optional Workplace Tools panel contains clearly marked unavailable
    integrations; it is deferred rather than pretending GitHub, Slack, or a
    cloud connection exists.
20. DuckDB WASM Arrow date/time/decimal conversion needs a browser-native fixture
    before it can be called fully proven; Node-side checks are not enough.

Items 9–20 are explicit follow-up risks, not hidden release gates. No private
resume, account, paid API key, LinkedIn session, or real interview material is
required or committed.

## Finish receipts

- Taste lint: **0 errors, 0 warnings, 0 suggestions** across `docs/`,
  `README.md`, and the coaching source touched in this pass.
- Impeccable detector: one intentional warning remains on the amber advisory
  assessment rule. It is a semantic state marker, not a decorative card stripe.
- Browser proof: Playwright smoke is **174/174 steps green**; the clean Chrome
  Guest Computer Use pass opened the local desk and captured
  [`pivot-computer-desk.png`](pivot-computer-desk.png) with the warehouse,
  editor, single coach action, and private response visible together.
- Contrast spot-check against the rendered paper palette: body 15.69:1,
  Frosty action 6.07:1, and route copy 7.24:1. These are all above the
  4.5:1 text target.

## Takeover pass — 2026-08-02

This pass re-read the public checkout, challenged the coaching boundary, and
ran the real browser workbench after the UX hierarchy change.

### Fixed or made explicit

21. **Riff and Frosty competed for the learner's attention.** Riff is now the
    only primary directive: the ask and deliverable come first, followed by the
    editor and deterministic result. Frosty is a secondary, one-action advisory
    card after the result, with copy that says it coaches rather than grades.
22. **The shipped default was not LLM-driven.** The public build remains
    browser-local and deterministic. A narrow `CoachTransport` seam now permits
    a host-owned optional provider such as Luna-high only when an administrator
    explicitly configures `VITE_STAR67_COACH_ENDPOINT`; no endpoint or paid
    credential is present in this repository.
23. **A remote coach could accidentally become an authority.** The request
    contains only visible ask/schema/relationship/query context; responses are
    schema-validated, answer-key material and runnable SQL are rejected, the
    source is forced to `remote`, and timeout/malformed/provider failure falls
    back to local Frosty. Grading and progress mutation remain deterministic and
    local.
24. **The screen-runner contract had only static coverage.** A direct contract
    now starts an attempt, solves each policy question once, rejects duplicate or
    out-of-policy evidence, and proves completion is derived rather than stored.
25. **Progress import could claim success when storage failed.** Import now
    refuses to reload after a failed write, reports a storage-specific message,
    and the progress contract covers that failure. The progress-code copy path
    also uses the same browser-safe fallback as result-cell copy.
26. **The test facade exposed too much engine authority.** `window.__engine`
    now exposes boolean cold-state and bounded read-only/test seams only; it no
    longer publishes database handles or mutable run methods.

### Release boundary and remaining work

The real Luna-high server bridge is intentionally not shipped: the public app
must not ask learners for a key or send their warehouse to an unreviewed
endpoint. A future host may provide the endpoint behind its own consent,
credential, retention, and rate-limit policy. Until then, Frosty is the truthful
private default.

Lower-risk follow-ups remain explicit: run the full browser smoke path in CI,
publish per-artifact checksums, make generator output transactional, add a few
relationship-field screen-reader labels, and keep the optional Workplace Tools
surfaces visibly disconnected. These are not hidden release gates.

### Fresh proof

- `npm run build`: data generation, all deterministic/error/format/pack/
  progression/crew/casebook/navigator/progress/screen/coaching contracts, TypeScript,
  and Vite build all green.
- `npm run smoke -- http://127.0.0.1:5198`: **174/174 steps green**, including
  the Riff-first workbench, one-action Frosty flow, no-network local coaching,
  narrow/desktop layouts, cancellation, progress persistence, and screen runs.
- `npm run progress`: **15 ProgressV2 contracts green**.
- `npm run screen`: direct immutable-evidence/completion contract green.
- `npm run coaching`: local default, bounded optional provider, timeout,
  malformed reply, unsafe reply, and cancellation contract green.
- `git diff --check`: clean.
