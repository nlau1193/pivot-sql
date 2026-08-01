# Star67 security audit

Audit date: 2026-08-01  
Audited revision: `ccf62c339cf0d7072c53a524b41dc961d463aa46`  
Production surface: <https://learn-sql-peach.vercel.app/>

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
- `npm audit --omit=optional --json`: 0 vulnerabilities across 178 installed
  dependency entries.
- `gitleaks detect --source . --no-git`: one `generic-api-key` match at
  `src/Workspace.tsx:86`. It is the local-storage namespace
  `pivot.navigatorWidth.v1`, not a credential. The same historical match is
  present in the initial public-release commit. It is kept and documented as a
  false positive; no secret was found.
- Static sink sweep: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, `document.write`, or `postMessage` use in the app sources.
- Sensitive-file sweep: no tracked `.env`, private-key, certificate, or
  credentials filename.
- Production headers: HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, and strict referrer policy are present. A CSP and
  `Permissions-Policy` are not currently set; adding them is deferred until
  the DuckDB WASM/worker runtime contract is tested rather than risking a
  broken browser workspace.

## Follow-up

Rerun Codex Security with an account/model that has access and enough budget to
reach `progress.coverage.closedRows > 0`; only then treat a zero finding count
as a completed AI audit.
