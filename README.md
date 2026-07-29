# Pivot

Hi, I’m Nicole. I built Pivot because learning SQL felt much harder than using
SQL to answer an actual finance question.

Pivot gives you a fictional FP&A job, a realistic finance database, and a first
query that already works. You learn by helping a company answer questions about
revenue, budgets, headcount, customers, and operating performance—not by
memorizing syntax in isolation.

![Your first day at Star67](public/pivot-social.png)

Everything runs in your browser. There is no account, no personal data to
upload, and no AI API to configure.

## Try your first task

Download or clone this repository, open its folder in Terminal, and run:

```bash
npm ci
npm run dev
```

You need Node.js 20 or newer. Open the local address shown in Terminal, choose
**Open my desk**, and press **Run** on the query waiting for you.

That is the whole setup. Pivot generates its fictional finance database
automatically.

## What you’ll practice

Pivot currently includes:

- 242 guided FP&A tasks
- A deterministic fictional database with 2,930,845 rows
- Projects covering revenue, planning, variance analysis, workforce costs,
  retention, forecasting, and close
- Plain-English error help
- Saved SQL you can reuse
- 37 skill badges backed by checked work
- Five optional interview-practice sets

You do not need to finish hundreds of lessons before accomplishing something
useful. The first query is ready to run, and each task builds naturally from the
work before it.

There are no streaks, arbitrary points, or hidden readiness scores. Your
progress is simply the work you have completed, the SQL you have saved, and the
next skill you are building.

## Welcome to Star67

Pivot takes place at Star67, a fictional data company in 2030.

Companies now have AI agents doing real work across their businesses, but they
still need to know who authorized that work, what it cost, which data it used,
and whether it produced a useful result. Star67 is the system of record for
that activity.

The name is a small reversal of `*67`: instead of hiding who is calling, Star67
makes machine work accountable.

You join the FP&A team during a difficult moment. Usage is growing quickly, ARR
and recognized revenue do not agree, customer ownership keeps changing, and
hiring has outpaced the plan. Before Finance updates the live 2030 forecast, you
replay the company’s archived 2026 database and rebuild the controls the team
needs.

Every company, person, transaction, task, and result in Pivot is fictional. The
practice is designed to feel realistic; it does not reproduce any real
company’s private data or interview process.

## Meet the Animina crew

The crew is the heart of Pivot. These six hand-drawn guides began in the
Animina character universe and now run the Star67 finance desk:

- **Riff**, the giraffe CFO, helps with structure and relationships.
- **Rex**, the rhino Controller, watches joins, duplicates, controls, and
  missing values.
- **Coco**, the dog People Partner, helps connect analysis to a clear business
  explanation.
- **Zi**, the penguin CEO, keeps the work focused on decisions and outcomes.
- **Fin**, the shark Data Lead, cares about SQL correctness, data grain, and
  reliable queries.
- **Frosty**, the koala Recovery Coach, offers calm help when a query gets
  stuck.

They are not a second points system or decoration added after the fact. Each
one represents a different kind of judgment that real finance work requires.

Their exact visual identity is protected by a deterministic manifest and
checksum contract. New poses start from an immutable character anchor, so a
new illustration can be surprising without quietly turning Coco into a bird or
Frosty into a teddy bear.

The artwork is copyright First Bite Labs LLC and is included by permission. It
is not covered by Pivot’s MIT License; see
[`public/characters/desk-crew/ASSET_LICENSE.md`](public/characters/desk-crew/ASSET_LICENSE.md).

## Private by design

Pivot uses DuckDB inside a browser web worker. Your SQL, query results, saved
work, progress, and built-in coaching interactions stay in your browser. The
public version uses deterministic guidance written into the app, so coaching
does not send a request to an external AI service.

If you clear your browser storage, your local progress may be removed. Pivot
includes a progress-code export so you can keep or move your work yourself.

## Build and test it

For the full local release check:

```bash
npm test
npm run build
npm run preview
```

`npm test` checks deterministic data generation, error explanations,
formatting, task packs, navigation, badge progression, progress import, and the
six immutable crew identities.

For browser-level testing against the preview app:

```bash
npm run smoke
npm run crew:proof
```

To compose a deterministic image-edit prompt for a new crew pose:

```bash
npm run crew:prompt -- frosty "Helping a learner recover from a broken join"
```

The prompt always names the base reference and identity locks. Generated
variants stay outside `public/` until a human visual review passes.

Add `--write` to save a prompt receipt with the base hash, prompt hash, variant
slug, and intended output. Before reviewing a generated PNG, verify that it is
traceable and has the required transparent format:

```bash
npm run crew:verify -- output/crew-studio/example.png output/crew-studio/example.prompt.json
```

## Project map

- `src/` — the React app, SQL workspace, task grading, progress, and Star67 crew
- `scripts/generate-data.mjs` — deterministic fictional finance-data generator
- `scripts/*contract.mjs` — behavioral and release contracts
- `public/data/` — generated local warehouse files
- `public/characters/desk-crew/` — licensed art, provenance, and identity
  manifest
- `public/duckdb-extensions/` — local DuckDB extension files

## Contributing

I want Pivot to remain welcoming to someone who knows spreadsheets but may
never have opened a code editor before.

A good contribution should make the first useful result faster, the finance
work more realistic, or the explanation clearer. Please keep the experience
local-first and avoid adding a new system when a smaller visible improvement
will do.

Changes to task content, grading, or character identity need a deterministic
contract. User-interface changes should be checked in a real browser at
desktop and narrow mobile widths.

## License

Pivot’s source code is MIT licensed. See `LICENSE`.

The Animina character and world artwork has a separate, more restrictive
license. See
[`public/characters/desk-crew/ASSET_LICENSE.md`](public/characters/desk-crew/ASSET_LICENSE.md).
