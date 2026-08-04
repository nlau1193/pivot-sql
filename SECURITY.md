# Star67 security audit

Audit date: 2026-08-04
Audited application sources: current Star67 branch (README/browser-first change
on `6ebcb93`) plus the security baseline at `1dece78`
Production surface: <https://learn-sql-peach.vercel.app/>
Live readback: the production surface returned HTTP 200 on 2026-08-04, served
the Star67 title, and returned HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, strict referrer policy, and restrictive
`Permissions-Policy` headers.

## Disposition

No confirmed security vulnerability was found in the checks completed below.
The Codex Security AI worklist did **not** complete, so this is not a claim of
full AI-scan coverage.

## Checks completed

- [`@openai/codex-security`](https://github.com/openai/codex-security) `0.1.5`:
  CLI help and dry-run preflight passed. ChatGPT-authenticated repository,
  source, and focused attempts stopped during preflight at their bounded cost
  limits; their `closedRows` coverage was `0`. API-key attempts could not use
  the configured Terra/Sol models. A zero finding count from those runs is not
  treated as a clean result.
- `npm audit --omit=optional --json`: 0 vulnerabilities across the current
  dependency tree.
- `gitleaks git --log-opts='origin/main..HEAD' --redact`: 0 findings in the
  README change.
- `gitleaks dir src --redact`: one `generic-api-key` match at
  `src/Workspace.tsx:87`. It is the local-storage namespace
  `pivot.navigatorWidth.v1`, not a credential. The same historical match is
  present in the initial public-release commit. It is kept and documented as a
  false positive; no secret was found.
- Static sink sweep: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, `document.write`, or `postMessage` use in the app sources.
- Sensitive-file sweep: no tracked `.env`, private-key, certificate, or
  credentials filename.
- Production headers: HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, and strict referrer policy are present. A restrictive
  `Permissions-Policy` is now set because the application does not request
  camera, microphone, location, payment, or device permissions. A CSP remains
  deferred until the DuckDB WASM/worker runtime contract is tested rather than
  risking a broken browser workspace.

## Follow-up

Rerun Codex Security with an account/model that has access and enough budget to
reach `progress.coverage.closedRows > 0`; only then treat a zero finding count
as a completed AI audit.

The header change above is a low-risk hardening measure, not a substitute for
that incomplete AI scan or a production deployment readback.
