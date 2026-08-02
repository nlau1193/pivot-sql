# Star67

Star67 is a small, local SQL practice desk. The story is fictional: you work
through finance questions inside an imagined AI-era data company, using a real
browser database and clear, checkable feedback.

![Star67 welcome desk](public/star67-social.png)

## Start here

For someone using the app, not changing its code:

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. From this folder, run:

   ```bash
   ./start
   ```

The first run installs the local open-source dependencies, builds the practice
warehouse, and opens `http://127.0.0.1:5199/`. Later runs reuse that build. Keep
the Terminal window open while you practice; press **Ctrl-C** when you are
done. If the browser does not open, visit the printed local address yourself.

Everything stays on this device. There is no account, upload, API key, paid
service, or model call in the public build. Frosty is the built-in authored
coach; it suggests a next step, while the local warehouse checker grades the
SQL. Your saved queries and progress stay in this browser.

![Star67 practice desk](docs/pivot-computer-desk.png)

## What you’ll do

- Answer questions about revenue, planning, headcount, customers, and performance.
- Learn practical SQL through guided tasks, reusable queries, and clear feedback.
- Work through 242 guided tasks and see skills earned as you practice.

## For contributors

Requires Node.js 20 or newer:

```bash
npm ci
npm run dev
```

Before opening a pull request, run `npm test` and `npm run build`. The source
code is MIT licensed; the Animina artwork has a separate
[asset license](public/characters/desk-crew/ASSET_LICENSE.md), described in
the [third-party notices](THIRD_PARTY_NOTICES.md).

To replay the browser proof locally, start a production preview in one
terminal, then run the existing smoke path in another:

```bash
npm run preview -- --host 127.0.0.1
npm run smoke -- http://127.0.0.1:5199
```

The optional coaching bridge is a developer integration, not part of setup. A
host that owns a safe server boundary may build with
`VITE_STAR67_COACH_ENDPOINT=/api/coach`; the public build leaves it unset and
remains local-only. Any bridge must return the versioned `CoachResponseV1`
contract and must not receive answer keys or progress internals.
