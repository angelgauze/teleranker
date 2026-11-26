# TeleRanker

Comparison site for mobile telecom promos in the Philippines (Globe, Smart,
DITO, TNT and GOMO; the provider list is configurable). Requirements live in
[`AGENTS.md`](./AGENTS.md).

## Status

| Area | State |
| --- | --- |
| Promo listing with filters and sorting | Implemented |
| Value ranking (GB per ₱100) | Implemented ([`docs/ranking.md`](./docs/ranking.md)) |
| Compare view (up to two promos) | Implemented |
| DITO collector | Working; run manually until the weekly job has a host |
| Globe collector | Implemented, but the site currently blocks it; hand-entered promos are listed beside collected ones |
| Smart, TNT, GOMO | Manual import only ([`docs/providers.md`](./docs/providers.md)) |
| Safe publishing, run logs, alerts | Implemented (alerts go to the console until a channel is chosen) |
| Reviews, admin panel, provider pages, site navigation | Not built yet |

No provider data is committed to this repository. Promos appear only after a
collection run or a manual import publishes to your own database.

## Stack

TypeScript (strict), Next.js App Router (React 19), Tailwind CSS v4,
PostgreSQL, Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`), Zod 4,
Cheerio, Vitest and tsx. Rationale:
[`docs/adr/0001-tech-stack.md`](./docs/adr/0001-tech-stack.md).

## Setup

```bash
pnpm install
cp .env.example .env                               # set DATABASE_URL
pnpm db:migrate                                    # create the schema
pnpm scrape --provider=all --live --publish        # collect and publish promos
pnpm import:promos --file=<promos.csv> --publish   # hand-entered providers (CSV kept outside the repo)
pnpm dev                                           # http://localhost:3000
```

`DATABASE_URL` must be a PostgreSQL connection string. `.env` is gitignored;
`.env.example` is committed.

## Deploying

1. Set `DATABASE_URL` in the host's environment settings, never in a committed file.
2. Build with `pnpm install` (also generates the Prisma client) and `pnpm build`.
3. Apply migrations with `pnpm db:deploy`. Never run `db:migrate` against a hosted database.
4. Load data from any machine whose `DATABASE_URL` points at the hosted database: run the
   scrape with `--publish`, then the import with the sheet. The site shows the data at once.
5. Back up the database (`pg_dump`) before demos and releases.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js dev server, production build, production server |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Unit tests (no database needed) |
| `pnpm db:setup-test` / `pnpm test:db` | Prepare the `*_test` database, then run the PostgreSQL tests ([Tests](#tests)) |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma client, migrations, data browser |
| `pnpm db:deploy` | Apply migrations to a hosted database ([Deploying](#deploying)) |
| `pnpm scrape --provider=<id> --live [--publish]` | Collect promos (`dito`, `globe` or `all`) |
| `pnpm scrape --provider=<id> --fixture=<path>` | Parse a saved page offline |
| `pnpm scrape ... --accept-smaller-set` | Publish a held-back run after checking the provider's page ([maintenance](./docs/providers.md#maintenance-runs-on-hold-and-errors)) |
| `pnpm import:promos --file=<csv> [--publish]` | Validate (and publish) the hand-entered promo sheet, listed beside collected promos ([manual import](./docs/providers.md#manual-import)) |
| `pnpm overrides:template --provider=<id> --out=<csv>` | Export the override sheet for a collected provider, pre-filled ([checked values](./docs/providers.md#checked-values-on-collected-promos-overrides)) |
| `pnpm import:overrides --file=<csv> [--publish]` | Validate (and save) checked 4G/5G values for collected promos |

## Layout

```
prisma/                     Schema (Provider, Promo, PromoOverride, Review, ScrapeRun) and migrations
src/app/                    Listing and compare pages
src/lib/schema/             Zod schemas: the single validation boundary
src/lib/collect/            Fetching, validation, publish policy, alerts, provider registry
src/lib/collect/collectors/ Provider parsers and HTML fixtures
src/lib/db/                 Prisma client, repository, listing queries, error messages
src/lib/manual/             CSV parser, promo sheet and override sheet import
src/lib/overrides/          Applying checked values to collected promos
src/lib/ranking/            Value metric and sorting
src/lib/ui/                 Formatting and status helpers
scripts/                    Collection, import and test-database CLIs
docs/                       ADR, ranking formula, provider decisions
```

Nothing outside `collectors/` knows a provider's markup; ranking and UI code
never import from it; every record written to `Promo` passes
`promoInputSchema` first.

## How it works

**Collection.** A collector parses a provider page into drafts, every draft is
validated, and the run publishes only if it passes the safety check (enough
records, few rejections, not much smaller than before). Otherwise the previous
promos stay listed, an alert is raised, and the run is logged. Promos that
disappear become "no longer offered", not deleted. Details:
[`docs/providers.md`](./docs/providers.md).

**Ranking.** Value is all-access GB per ₱100. Validity is shown separately as
GB/day and ₱/day. Unlimited promos and promos with unknown data or validity are
listed but never scored. Coverage and speed are not part of the score. Details:
[`docs/ranking.md`](./docs/ranking.md).

**Data model.**

- Money is integer centavos (`7000` is ₱70.00).
- Data is `TOTAL`, `UNLIMITED`, `NONE` or `UNKNOWN`; unknown is never stored
  as zero. `allAccessGb` is the all-network part when a provider splits data.
- `noExpiry` marks promos that never expire, distinct from unknown validity.
- Compatibility is about phones: `FIVE_G` needs a 5G phone,
  `FOUR_G_AND_FIVE_G` works on any LTE phone, `UNKNOWN` by default.
- `origin` is `COLLECTED` (collector run) or `MANUAL` (import).
- `PromoOverride` holds values a person checked (4G/5G compatibility for now),
  applied on top of collected promos on every run.
- A promo not re-checked for more than 14 days shows as "Outdated"
  (`src/lib/freshness.ts`).

## Tests

```bash
pnpm test
```

Covers schemas, parsing, provider parsers against saved fixtures, the publish
policy, collection runs, the manual import, filters, formatting and the
ranking formula. Tests never call provider websites and use synthetic data.

The PostgreSQL tests (`src/lib/db/*.db.test.ts`) run against a separate
database, never the real one:

```bash
# once: add TEST_DATABASE_URL to .env (see .env.example); its name must end in "_test"
pnpm db:setup-test     # creates it and applies migrations (re-run after a new migration)
pnpm test:db
```

Without `TEST_DATABASE_URL` they are skipped.

## Dependencies beyond the framework

- `zod`: one validation layer for scraped, imported and user input.
- `cheerio`: HTML parsing for provider pages.
- `@prisma/client`, `@prisma/adapter-pg`, `prisma`, `dotenv`: database layer.
- `vitest`: tests. `tsx`: runs the TypeScript CLIs.

## Open decisions

Tracked in [`AGENTS.md`](./AGENTS.md) §14, notably: provider terms sign-off
before scheduled runs, where the weekly job runs and how alerts are delivered,
coverage and speed sources, admin authentication, review rules, and hosting.
