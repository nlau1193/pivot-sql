# Star67

[Open Star67 in your browser →](https://learn-sql-peach.vercel.app/)

Learn SQL by solving realistic finance questions inside a fictional company.
Practice at the Star67 finance desk in your browser—no account, uploads, or AI
setup required.

![Star67 finance desk](public/star67-social.png)

## Start here

Open Star67, choose your first task, and press **Run**. The first query is ready
for you. Use the plain-English hints if you get stuck. Your saved SQL and
progress stay in this browser.

## What you’ll do

- Answer questions about revenue, planning, headcount, customers, and performance.
- Learn practical SQL through guided tasks, reusable queries, and clear feedback.
- Work through 242 guided tasks, optional interview practice, and skills you can clearly see earning.

## Private by design

DuckDB and deterministic coaching run in your browser. There is no account,
personal-data upload, or external AI API. Export your progress if you want to
move it; clearing browser storage resets local progress.

### Optional AI coaching (not enabled in the public build)

The built-in Frosty coach is the reliable default: it is authored, private, and
works offline. A host that owns a safe server boundary can opt into an
OpenAI-compatible coaching bridge (for example, a local Luna-high bridge) by
building with `VITE_STAR67_COACH_ENDPOINT=/api/coach`. The browser sends a
bounded, visible-work snapshot only after you press the coaching button; it
never sends the answer key, grading internals, or progress. The server owns any
model credentials and must return the versioned `CoachResponseV1` contract.
Malformed, timed-out, unavailable, or unsafe replies fall back to Frosty
without changing SQL or progress. The hosted Star67 build leaves this variable
unset, so it remains no-network and no-paid-tooling.

## For contributors

Local setup is only for people changing the project. Requires Node.js 20+:

```bash
npm ci
npm run dev
```

Before opening a pull request, run `npm test` and `npm run build`. The source
code is MIT licensed; the Animina artwork has a separate
[asset license](public/characters/desk-crew/ASSET_LICENSE.md).
