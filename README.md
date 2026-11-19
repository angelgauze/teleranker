# TeleRanker

Comparison site for mobile telecom promos in the Philippines (Globe, Smart,
DITO and any provider added later). Requirements live in [`AGENTS.md`](./AGENTS.md).

## Status

| Area | State |
| --- | --- |
| Promo listing with filters and sorting | Implemented |
| Value ranking (GB per ₱100) | Implemented, formula in [`docs/ranking.md`](./docs/ranking.md) |
| Compare view (up to two promos) | Implemented |
| Collectors for Globe and DITO | Implemented, run manually or on a schedule |
| Smart collector | Not possible; manual entry only (see [`docs/providers.md`](./docs/providers.md)) |
| Safe publish + run logging + alerts | Implemented (console alert sink until a channel is chosen) |
| Admin panel, manual overrides, review submission UI | Not built yet |

No provider data is committed to this repository. Promos appear only after a
collection run publishes to your own database.

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| Framework | Next.js App Router (React 19) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM | Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`) |
| Validation | Zod 4 |
| HTML parsing | Cheerio |
| Tests | Vitest |
| Script runner | tsx |

Rationale: [`docs/adr/0001-tech-stack.md`](./docs/adr/0001-tech-stack.md).

## Setup

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL
pnpm db:migrate                 # create the schema
pnpm scrape --provider=all --live --publish   # collect and publish promos
pnpm dev                        # http://localhost:3000
```

Prisma 7 requires a driver adapter, so `DATABASE_URL` must be a PostgreSQL
connection string. `.env` is gitignored; `.env.example` is committed.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev, production build, production server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm db:generate` | Generate the Prisma client into `src/generated/prisma` |
| `pnpm db:migrate` | Create and apply a migration |
| `pnpm db:studio` | Browse data in Prisma Studio |
| `pnpm scrape --provider=<id> --live [--publish]` | Collect promos |
| `pnpm scrape --provider=<id> --fixture=<path>` | Parse a saved page offline |

Supported ids: `globe`, `dito`, `all`. `smart` is refused because its promo
pages sit behind a bot-protection challenge.

## Layout

```
prisma/schema.prisma        Provider, Promo, Review, ScrapeRun
prisma/migrations/          Applied migrations
src/app/                    Listing, compare view, route handlers
src/lib/schema/             Zod schemas — the single validation boundary
src/lib/collect/            Fetch (robots-aware), normalise, validate, publish policy
src/lib/collect/collectors/ Provider parsers + HTML fixtures
src/lib/db/                 Prisma client, repository, listing queries
src/lib/ranking/            Value metrics and sorting (pure functions)
src/lib/ui/                 Formatting helpers
scripts/scrape.ts           Collection CLI
docs/                       ADR, ranking formula, provider compliance
```

Boundaries (`AGENTS.md` §8):

- Nothing outside `src/lib/collect/collectors/` knows a provider's markup.
- `src/lib/ranking/` and the UI must not import from `collectors/`.
- Every record written to `Promo` passes `promoInputSchema` first.

## How collection works

```
collector -> PromoDraft[] -> Zod validation -> publish policy -> Postgres
                                     |                |
                              rejections logged   blocked runs keep
                                                  last-known-good data
```

- `robots.txt` is enforced before every request; requests are spaced by at
  least 2 seconds per host and identify the bot.
- A run publishes only if it collected records, kept at least 50% of them, and
  did not shrink below 50% of the currently published set. Otherwise it is
  blocked, alerted and recorded with `published = false`.
- Promos that disappear from a provider page are marked `UNAVAILABLE`, not
  deleted, so users can see they are no longer offered.
- Diagnostics stored in `ScrapeRun` contain rejection reasons, never HTML or
  credentials.

Details and evidence per provider: [`docs/providers.md`](./docs/providers.md).

## Ranking

Value = **all-access GB per ₱100**, i.e. `(all-access GB ÷ price in ₱) × 100`.
Validity is reported separately as GB/day and ₱/day. Unlimited promos and promos
with unknown data or validity are listed but never scored, so they cannot be
mistaken for zero-value offers. Coverage and speed are not part of the score
because no agreed data source exists.

Full definitions, worked examples and limitations:
[`docs/ranking.md`](./docs/ranking.md).

## Data model notes

- Money is integer centavos; `7000` is ₱70.00.
- `DataAllocationKind` separates `TOTAL`, `UNLIMITED`, `NONE` and `UNKNOWN`;
  `dataGb` exists only for `TOTAL`.
- `allAccessGb` stores the all-network part of the allowance when the provider
  splits it.
- Validity keeps the published value and unit; conversion to days happens in the
  ranking layer.
- Compatibility defaults to `UNKNOWN` for collected promos. 5G support is never
  inferred from the provider's network.
- Reviews store a blank name as `NULL` and cap the body at 400 characters.

## Tests

```bash
pnpm test
```

Coverage includes schema validation, text normalisation (price/data/validity),
robots parsing, publish-policy guards, provider parsers against captured
fixtures, the collection orchestration (empty/suspicious/failed runs) and the
ranking formula. Tests never call provider websites.

## Dependencies added beyond the framework

- `zod` — one validation layer for scraped, admin and review input.
- `cheerio` — provider pages are HTML; a real parser is safer than regex.
- `@prisma/client`, `@prisma/adapter-pg`, `prisma`, `dotenv` — database layer and Prisma 7 config.
- `vitest` — unit tests.
- `tsx` — runs `scripts/scrape.ts` with TypeScript and path aliases.

## Open decisions

Tracked in `AGENTS.md` §14. Most relevant now:

1. Provider terms-of-use review before scheduled production runs
   (`termsReviewed` is `false` for all three providers).
2. Scraping schedule and alert delivery channel.
3. Definition of a promo's 4G/5G compatibility — collected promos stay
   `UNKNOWN` until this is decided.
4. Coverage and speed sources for provider-level value-for-money.
5. Admin authentication, review moderation, and whether reviews attach to
   providers, promos, or both.
6. Hosting and rollback procedure.
