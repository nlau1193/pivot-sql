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
