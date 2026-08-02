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
9. **The desk displayed disconnected GitHub/Slack cards and not-installed
   future desks.** Those were static placeholders with no connection or install
   action, so they added decision noise without capability. The learner surface
   now keeps the four core directions and local progress/import only; the
   internal pack registry remains a code seam, not a promise of integrations.

## Reproduced or source-backed follow-up inventory

9. **Current CI browser proof:** `.github/workflows/ci.yml` installs Chromium and
   runs the production-preview smoke path on every push and pull request. The
   earlier audit wording that said otherwise predates that workflow change and
   is no longer an open release follow-up.
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
19. DuckDB WASM Arrow date/time/decimal conversion needs a browser-native fixture
    before it can be called fully proven; Node-side checks are not enough.

Items 10–19 are explicit follow-up risks, not hidden release gates. No private
resume, account, paid API key, LinkedIn session, or real interview material is
required or committed.

## Finish receipts

- Taste lint: **0 errors, 0 warnings, 0 suggestions** across `docs/`,
  `README.md`, and the coaching source touched in this pass.
- Impeccable detector: unavailable in this environment; no detector result is
  claimed. The amber advisory rule remains a semantic state marker, not a
  decorative card stripe.
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

Lower-risk follow-ups remain explicit: publish per-artifact checksums, make
generator output transactional, and add a few relationship-field screen-reader
labels. The removed integration cards are not a release gate; a future
integration would need a real consented boundary before it returns to the
learner surface.

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

### Additional bounded candidates (27–31)

27. The static host does not currently emit a Content-Security-Policy or
    Permissions-Policy header; a future hosted wrapper should add one without
    breaking DuckDB workers or the explicitly optional coaching endpoint.
28. The production bundle is about 2.6 MB before the 34–39 MB DuckDB WASM
    artifact. Code-splitting the desk/workbook surfaces could reduce the first
    JavaScript parse cost on slower laptops.
29. Workbook tab buttons use `aria-controls` for panels that can be unmounted
    when tabs close. A future accessibility pass should keep the referenced
    panel in the accessibility tree or remove the relationship while it is
    absent.
30. The React root has no error boundary. An unexpected render exception would
    lose the recovery copy and leave a blank shell instead of a local retry
    message.
31. The public debug seams used by browser proof are bounded today, but a
    future release should keep test-only hooks behind an explicit development
    build flag so production bundles expose fewer inspection affordances.

### Focused review fix — 2026-08-02

32. **A non-cooperative optional coach could hang the learner forever.** The
    timeout previously aborted the signal but still awaited a transport that
    ignored it. `requestCoach` now races the provider promise against the same
    timeout boundary, falls back to local Frosty guidance, and the provider
    contract holds a deliberately hanging adapter for the full timeout window.

### Focused review fixes — 2026-08-02

33. **A host could point the optional coach at an arbitrary origin.** The
    transport now accepts relative or same-origin endpoints only. A host may
    still proxy to a paid model behind its own consent and retention policy;
    the public build cannot silently post visible SQL and schema cross-origin.
34. **A completed ask could become a dead end after a later SQL error.** The
    delivered bar now follows the persisted campaign completion state and keeps
    the next navigation action available while the learner retries freely.
35. **The raw engine-error disclosure advertised a conditional target.** Its
    controlled `<pre>` now stays mounted and toggles hidden state, so the
    `aria-controls` relationship is truthful before and after expansion.
36. **The editor had no accessible name and the mobile Data opener had no state.**
    The SQL editor is now labelled, and the database drawer opener exposes
    `aria-expanded` alongside its dialog relationship.
37. **Public metadata and first success copy implied a real employer or job.**
    The title, social metadata, and learner-facing lesson copy now say
    “realistic finance questions” inside a fictional Star67 desk; named-company
    readiness data remains an internal, explicitly fictional practice layer.
38. **Progress language still exposed badge/dossier jargon.** The visible
    Progress view now leads with “skills,” “next skill to practice,” and plain
    “more skills,” while evidence IDs remain implementation-only contracts.

The company-card/readiness generator remains a documented simplification
candidate: it is not a visible Progress dependency today, but removing the
catalog would be a deliberate content migration rather than a review-side
cleanup. Generated-data transactionality/checksums, relationship-field labels,
browser smoke in CI, CSP/error boundary, code-splitting, and description search
remain bounded follow-ups.

## Final takeover receipt — 2026-08-02

This receipt supersedes the earlier browser proof counts above. It records the
final Star67 workbench boundary without inventing a hosted or paid-provider
claim.

- `npm test`: green — deterministic artifacts, error corpus, format, pack,
  progression, crew, casebook, navigator, ProgressV2, screen-runner, and
  coaching contracts.
- `npx tsc -b --pretty false`: green.
- `npm run build`: green — regenerated **2,930,845 rows / 25.7 MB**, all
  contracts, TypeScript, and Vite production output; the largest JS bundle is
  2.61 MB before DuckDB WASM.
- `npm run smoke -- http://127.0.0.1:5198`: **175/175 steps green**, with no
  uncaught page errors and no hosted/private API requests. The proof covers
  Riff-first hierarchy, the one-action local Frosty coach, desktop/narrow
  workbench behavior, progress language, cancellation, and screen practice.
- Visual proof remains [`pivot-computer-desk.png`](pivot-computer-desk.png),
  showing the ask, editor, result area, and secondary Frosty card in one desk.
- Taste lint: **0 errors, 0 warnings, 0 suggestions** across `docs/` and
  `README.md`.
- The public default is deterministic and browser-local. The optional coach
  seam accepts only relative or same-origin endpoints, validates replies,
  cannot grade or mutate progress, and falls back to Frosty on timeout or
  malformed output. No Luna-high endpoint, credential, or paid tool is shipped.
- Impeccable was not installed or available in this environment, so no detector
  result is claimed. The amber assessment remains an intentional semantic state
  marker rather than a decorative card stripe.

The remaining candidates are deliberately bounded: transactional/checksummed
generation, relationship-field labels, CSP/error boundary, code splitting, and
development-only debug hooks. CI browser smoke is already covered by the
current workflow. These are not reproduced release regressions, so this pass
does not churn the proven surface.

## Simplification fix — 2026-08-02

The old disconnected-tools and future-desk cards are gone from the learner UI.
The browser proof now asserts their absence, four core directions, and the same
local-only privacy boundary: **175/175 steps green** after the removal. This is
the final learner-facing boundary for this pass; no GitHub, Slack, OAuth, or
cloud connection is shipped or implied.
