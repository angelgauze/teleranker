# ADR 0001 — Technology stack

- **Status:** Accepted, 2026-11-19; confirmed by the project team (recorded 2026-11-20)
- **Deciders:** Project owner and student team
- **Supersedes:** none

## Context

The repository started empty (only `AGENTS.md`, no commits). `AGENTS.md` §8
requires a stack recommendation with reasons before scaffolding, and §14 lists
the final stack as a team decision.

The application must support server-rendered promo listings within a 3-5 s
load budget, independent per-provider collectors, schema validation with safe
publishing, an admin panel with logs and alerts, and server-validated reviews -
while staying operable by a small student team.

## Decision

Single-deployable TypeScript stack with a relational database:

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Shared types from database to UI |
| Framework | Next.js App Router | Server rendering for listings; route handlers for admin and review APIs |
| Database | PostgreSQL | Relational fit for promo/provider/review/scrape-run data and constraints |
| ORM | Prisma 7 | Parameterised queries, migrations, typed client |
| Validation | Zod 4 | One schema validates scraped data, reviews and admin input |
| Styling | Tailwind CSS v4 | Responsive layouts without a component library |
| Tests | Vitest | Unit coverage for schemas, parsing, ranking and filtering |
| Collectors | Separate Node entrypoint, not web requests | Parsing stays out of UI and ranking code; run from cron or CI |

## Alternatives considered

1. **Vite + React SPA with a separate Fastify/Express API.** Cleanest explicit
   boundary and conventional for a student project, but two deploy targets and
   no server rendering for no requirement gain. Fallback if a visible API
   service is expected.
2. **Django + Postgres + HTMX.** Admin panel, auth and validation nearly free,
   and Python suits scraping, but splits the team across two paradigms.

## Consequences

**Positive:** one language and deploy artefact; server rendering meets the
performance target without extra caching; one validation layer covers scraped
and user-submitted data; collectors cannot break the web app.

**Negative / risks:** serverless hosts limit long scrapes, so collectors must
run as a separate scheduled process; Prisma migrations need rollback discipline
once published data exists; UI/API separation must be enforced by directory
boundaries and review because they share one project.

## Module boundaries

`app/` (pages, API), `lib/db/`, `lib/schema/`, `lib/ranking/`,
`lib/collect/`, `collectors/<provider>/`, `scripts/scrape.ts`.

Rule: nothing in the UI or ranking layer may import from `collectors/`.

## Not decided here

Hosting and rollback platform, admin authentication, alert channel, database
hosting, package manager confirmation, and whether coverage/speed data can be
sourced for value-for-money rankings are all still open in `AGENTS.md` §14.
