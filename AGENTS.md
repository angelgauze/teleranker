# AGENTS.md --- Telecom Promo Comparison Website

This file provides project context and working instructions for OpenCode
and other coding agents.

## 1. Project overview

Build a web application that helps consumers in the Philippines
discover, compare, and evaluate mobile telecommunications promos from
supported providers.

The application should make it easier for users to answer questions such
as:

- Which promo fits my budget?
- Which promo offers the most data for its price and validity period?
- Is a promo compatible with a 4G-only or 5G-capable phone?
- Which plan is better when comparing two promos side by side?
- Is the displayed promo information current and traceable to an
  official source?

The initial providers identified for the project are:

- Globe
- Smart
- DITO

Treat the provider list as configurable so additional providers can be
added without redesigning the application.

## 2. Source of truth and scope

### In scope

1.  Promo listing page with filtering and sorting.
2.  Promo rankings using documented criteria, including price, data
    allocation, and validity.
3.  Budget-range filtering.
4.  Sorting/ranking using data per day and price through a documented
    formula.
5.  Promo verification information:
    - Last-verified timestamp.
    - Link to the official provider source, when available.
    - Clear indication when an official source link is unavailable.
    - Status for outdated or unavailable promos.
6.  4G/5G compatibility:
    - Each promo has a 4G/5G compatibility property.
    - Users can filter promos by compatibility.
    - Use clear labels, icons, or colors to distinguish compatibility.
7.  Value-for-money ranking:
    - Separate 4G and 5G categories.
    - Consider price, coverage area, and speed as criteria.
    - Document the scoring method and avoid presenting unsupported
      measurements as facts.
8.  Side-by-side comparison of up to two selected promos.
9.  User-submitted reviews:
    - Optional name; blank means anonymous.
    - Review text limited to 400 characters.
10. Admin functionality for data management and manual overrides.
11. Automated data collection with validation, logging, and failure
    alerts.
12. Safe publishing that retains the last-known-good data if a scrape
    fails or produces invalid results.

### Out of scope unless the project team explicitly approves a change

- Telecom signal-strength or cell-tower maps.
- Live measurement of a user's mobile signal.
- Purchasing or subscribing to a promo.
- User accounts, authentication, or personalization beyond what is
  needed for an explicitly approved feature.
- Unapproved scraping methods that bypass access controls or technical
  restrictions.

## 3. User stories and acceptance criteria

### End users

#### Promo rankings

As a budget-conscious data-plan user, I want to view promos sorted by
price, data allocation, and validity so I can find suitable promos
without manually researching every provider.

Acceptance criteria:

- Promos can be sorted by price and validity.
- Users can filter promos by a budget range.
- Rankings can use a documented formula involving overall GB per day
  and price.
- The formula and its assumptions are visible in project
  documentation.

#### Promo verification

As a user exploring different promos, I want information that helps me
determine whether a promo is outdated and whether its details are
factual.

Acceptance criteria:

- Each promo displays its last-verified timestamp.
- Each promo links to its official provider source when one exists.
- If no official source link is available, the interface says so.
- Outdated and unavailable promos are visibly marked.

#### 4G/5G compatibility

As a user with a 4G or 5G phone, I want to filter promos by
compatibility.

Acceptance criteria:

- Each promo has a compatibility value.
- The listing can be filtered by 4G and 5G compatibility.
- Visual labels/icons distinguish 4G and 5G promos.
- Do not assume that a promo is 5G-compatible merely because the
  provider has a 5G network. Store and verify promo compatibility
  separately.

#### Value-for-money ranking

As a customer, I want to identify providers that offer good value,
considering more than just the lowest price.

Acceptance criteria:

- Providers are evaluated separately for 4G and 5G.
- The ranking criteria include price, area coverage, and speed, as
  stated in Phase 1.
- The implementation documents where coverage and speed data comes
  from.
- If reliable coverage or speed data is unavailable, do not fabricate
  it or imply that a price-only score represents the complete
  value-for-money criteria.

#### Side-by-side plan comparison

As a user choosing between promos, I want to compare selected plans next
to each other.

Acceptance criteria:

- Users can select no more than two promos.
- The comparison view presents equivalent fields consistently.
- Missing or unknown values are clearly identified rather than treated
  as zero.

#### User-submitted reviews

As a customer, I want to read and submit reviews about provider service
reliability.

Acceptance criteria:

- There is a submit-review action.
- Name is optional; an empty name is treated as anonymous.
- Review text is limited to 400 characters.
- Validate and sanitize submitted content on the server.
- Do not expose private or administrative data through review
  endpoints.

### Administrators

#### Reliable data collection

As an administrator, I want each provider's scraper to validate
collected data before publication.

Acceptance criteria:

- Each provider's scraper runs independently.
- Records that fail validation are rejected.
- A suspicious, empty, or invalid run does not replace published data.
- The application continues displaying the last-known-good data after
  a failed run.

#### Safe deployment and rollback

As an administrator, I want releases to be reversible.

Acceptance criteria:

- A failed release can be rolled back to the previous working version.
- Releases are monitored through logs and alerts.
- Document the deployment and rollback procedure.

#### Scraper failure alerts

As an administrator, I want to know when a scraper fails.

Acceptance criteria:

- Every run logs provider, timestamp, status, and record count.
- An alert is generated when a run returns no results or validation
  fails.
- Error details are useful for diagnosis but do not reveal secrets.

## 4. Non-functional requirements

Implement and test for the following requirements from Phase 1:

- **Data accuracy:** Promo prices, inclusions, validity periods, and
  data allocations should reflect collected provider information.
  Validate records against a defined schema before publication.
- **Data recency:** Record each promo's last-verified timestamp and
  identify outdated or unavailable information.
- **Performance:** Under normal operating conditions, primary
  information (promo listings, provider details, rankings, and
  comparisons) should load within approximately 3--5 seconds.
- **Usability:** Users should be able to browse, filter, rank, and
  compare plans without specialist knowledge.
- **Reliability:** The application should remain useful when a
  provider website is temporarily unavailable. Failed scraping must
  not overwrite valid existing data.
- **Data consistency:** Use consistent formats and calculations across
  providers so comparisons are fair.
- **Security:** Protect the backend and database. Never expose
  credentials or sensitive configuration to users. Restrict
  administrative functions and manual overrides to authorized
  administrators.
- **Compatibility:** The website should work on commonly used browsers
  and adapt to desktop and mobile screen sizes.
- **Maintainability:** Keep scraping, data processing, ranking
  calculations, backend queries, and frontend presentation separable.
- **Scalability:** Make it possible to add providers and promo
  categories without redesigning the application.
- **Data-collection compliance:** Use permitted data-access methods.
  Respect provider terms, access restrictions, and applicable
  policies. Do not bypass access controls or technical restrictions.

## 5. Data model guidance

The exact schema is a design decision. Inspect the current repository
and existing database before creating or changing it. The following is a
conceptual starting point, not a mandate.

### Promo

A promo record will likely need fields equivalent to:

- Stable internal ID.
- Provider ID.
- Promo name/title.
- Price and currency (PHP).
- Data allocation and unit.
- Validity duration and unit.
- 4G/5G compatibility.
- Calls and texts inclusions, including whether each is unlimited.
- Other relevant inclusions or restrictions.
- Official source URL, if available.
- Verification timestamp.
- Availability/status, such as active, outdated, or unavailable.
- Created/updated timestamps.
- Source or collection metadata sufficient to trace the record.

Represent unlimited, not applicable, and unknown values distinctly. Do
not encode all of them as zero or empty strings.

### Provider

A provider record should support:

- Stable ID.
- Display name.
- Official website/source information.
- Active/enabled status.

### Review

A review record will likely need:

- Stable ID.
- Related provider (and optionally a related promo if the team
  approves that scope).
- Optional display name.
- Review text (maximum 400 characters).
- Submission timestamp.
- Moderation/status fields if moderation is implemented.

### Scrape run

A scrape-run record should capture:

- Provider.
- Start and completion timestamps.
- Status.
- Number of records collected, accepted, and rejected.
- Error/diagnostic information safe for administrators.
- Whether the result was published.

Keep raw/normalized collected data separate from the currently
published, validated data when practical.

## 6. Ranking and comparison rules

Do not invent a ranking formula and present it as an agreed requirement.

The Phase 1 document mentions:

- Price.
- Data allocation (GB).
- Validity.
- Overall GB per day and price.
- Budget filtering.
- For provider value rankings: price, area coverage, and speed.
- Separate 4G and 5G rankings.

Before implementing rankings:

1.  Write down the formula in plain language and mathematical notation.
2.  Define how validity is converted to days.
3.  Define how daily data is calculated for promos with a total data
    allocation.
4.  Define how unlimited data, app-specific data, night data, capped
    data, and other special inclusions are handled.
5.  Define how missing values are treated.
6.  Ensure all providers are scored using the same rules.
7.  Add unit tests for representative and edge cases.
8.  Make the ranking explainable in the UI or supporting documentation.

Do not claim that a promo is objectively the "best" if the score only
measures one dimension. Label the metric accurately (for example,
data-per-peso) and document limitations.

## 7. Data collection and scraping rules

Data collection is a core project risk. Build provider collectors
independently so one provider's website changes do not break the others.

Before implementing a collector for a provider:

1.  Identify the official page(s) containing promo details.
2.  Check the provider's terms of use and relevant access restrictions.
3.  Inspect `robots.txt` as one input to the assessment; do not treat it
    as a substitute for terms or legal review.
4.  Check whether an official API, feed, downloadable dataset, or
    permitted structured endpoint exists.
5.  Prefer official and documented sources over scraping.
6.  Do not bypass authentication, CAPTCHAs, paywalls, rate limits, or
    other access controls.
7.  Use conservative request rates and identify the application
    appropriately where appropriate.
8.  Store the source URL and the time the information was checked.
9.  If automated collection is not permitted or is unreliable, support
    manual admin entry/override.

### Validation and safe publishing

- Validate all collected records against a shared schema.
- Normalize provider-specific formats before ranking or display.
- Reject malformed records and log why they were rejected.
- Detect suspicious runs, such as zero records or an unexpectedly
  large drop in record count.
- Never publish an empty or failed scrape over valid data.
- Keep the last-known-good published dataset available until a
  replacement passes validation.
- Make collection status and data freshness visible to administrators.

## 8. Architecture guidance

The stack is recorded in `docs/adr/0001-tech-stack.md`: Next.js App Router,
TypeScript, PostgreSQL with Prisma, Zod, Tailwind CSS and Vitest. Changes to it
need an ADR update, not a silent rewrite.

Before selecting frameworks, libraries, databases, or hosting:

- Inspect the repository and existing project files.
- Follow established conventions if the repository is already
  initialized.
- If it is empty, present a concise stack recommendation with reasons
  before scaffolding.
- Prefer a maintainable, well-supported stack that the student team
  can understand and operate.
- Avoid unnecessary services, dependencies, and premature complexity.

Regardless of stack, keep these responsibilities logically separated:

1.  Frontend pages and components.
2.  Backend/API and business rules.
3.  Provider-specific data collectors.
4.  Data normalization and schema validation.
5.  Ranking/scoring calculations.
6.  Persistence and published dataset management.
7.  Admin operations, logs, and alerts.

Use clear interfaces between these parts. Provider-specific parsing
should not leak into UI components or ranking calculations.

## 9. UI/UX guidance

The Phase 1 mockup scope identifies these main views:

- Promo listing page with filters.
- Compare view.
- Provider detail page.
- Admin panel.

The interface should make the following information easy to scan:

- Provider and promo name.
- Price in Philippine pesos.
- Data allocation.
- Validity.
- 4G/5G compatibility.
- Calls/text inclusions where applicable.
- Ranking metric or score, with an explanation.
- Last-verified date.
- Promo status.
- Official source link or an explicit indication that one is
  unavailable.

Use consistent labels and formatting across providers. Do not rely on
color alone to communicate 4G/5G compatibility, status, or ranking.

Design responsive layouts for mobile and desktop. Keep the comparison
view readable on narrow screens.

## 10. Security and privacy

- Keep secrets in environment variables or the platform's secret
  manager.
- Do not commit `.env` files, API keys, passwords, or tokens.
- Validate all input on the server, including review submissions and
  admin actions.
- Apply authorization checks to every administrative endpoint/action.
- Use parameterized database operations or the ORM's safe query APIs.
- Sanitize untrusted text before rendering.
- Avoid logging credentials, tokens, or unnecessary personal
  information.
- Do not collect user information unless it is needed for an approved
  feature.
- Document any authentication or moderation approach before
  implementing it.

## 11. Testing expectations

Add tests appropriate to the chosen stack.

At minimum, cover:

- Promo schema validation.
- Provider-specific normalization.
- Currency, data, and validity parsing.
- 4G/5G compatibility filtering.
- Budget filtering and sorting.
- Ranking formula and edge cases.
- Comparison of two promos, including missing values.
- Review character limit and input validation.
- Failed/empty scraper runs retaining last-known-good data.
- Admin authorization.
- API error handling.

Use fixtures or mocked provider responses for scraper tests. Tests
should not depend on repeatedly querying live provider websites.

## 12. Working instructions for OpenCode

When working on this repository:

1.  Read this file and inspect the repository before making changes.
2.  Identify the existing framework, package manager, scripts, and
    conventions.
3.  Do not replace the stack or restructure the project without
    explaining why and obtaining confirmation.
4.  Implement one coherent feature at a time.
5.  Keep changes focused; avoid unrelated refactors.
6.  Reuse existing components, utilities, and patterns where reasonable.
7.  Add or update tests when changing business logic.
8.  Run the relevant formatter, linter, type checker, and tests after
    changes. Report any command that could not be run.
9.  Do not claim a feature is complete unless it is implemented and
    verified.
10. Do not fabricate provider promo data, API responses, coverage,
    speeds, or source URLs. Use clearly labelled fixtures for
    development.
11. When provider information is uncertain, preserve the uncertainty in
    the data model and UI.
12. Update documentation when changing setup steps, environment
    variables, data schemas, scraping behavior, or ranking formulas.
13. Prefer accessible semantic HTML and keyboard-operable controls for
    the web interface.
14. Keep dependencies minimal and explain why a new dependency is
    needed.
15. Before destructive operations (dropping data, rewriting migrations,
    deleting substantial code), explain the impact and ask for
    confirmation.

## 13. Definition of done

A feature is ready when:

- It satisfies its agreed acceptance criteria.
- It handles loading, empty, and error states.
- It validates untrusted or external data appropriately.
- It is responsive and accessible for its intended interface.
- Relevant automated checks pass.
- Any limitations or assumptions are documented.
- No secrets or fabricated real-world provider information are
  introduced.

## 14. Open decisions to resolve with the project team

Do not guess these decisions. Track and resolve them explicitly:

- Final frontend, backend, and database stack — resolved 2026-11-19, see
  `docs/adr/0001-tech-stack.md`. App hosting is still open; database hosting
  is Neon (project `Teleranker`, branch `production`) as of 2026-11-25, see
  `README.md` and `neon.ts`.
- Package manager — pnpm proposed, not yet confirmed.
- Exact providers and promo categories supported in the first release.
- Exact definition of a promo's 4G/5G compatibility.
- Ranking formula and weighting — resolved for promo-level value on
  2026-11-19, see `docs/ranking.md`. Provider-level value-for-money that
  includes coverage and speed remains open.
- How area coverage and network speed will be sourced and compared.
- Treatment of unlimited, app-specific, night, rollover, and throttled
  data — partially resolved: unlimited and unverified promos are not
  scored, app-specific data is excluded from the comparable figure, and
  night/rollover/throttled inclusions are preserved in `dataNotes` until
  the team decides how to model them.
- Definition of when a promo becomes outdated.
- Scraping schedule and permitted collection method for each provider —
  methods resolved on 2026-11-19 in `docs/providers.md` (Globe and DITO
  automated and robots-permitted; Smart manual-only because of a bot
  challenge). The schedule and the terms-of-use review are still open.
- Whether reviews are associated with providers, promos, or both.
- Whether reviews require moderation.
- Admin authentication and authorization approach.
- Whether user accounts are needed at all.
- Alert delivery method.
- Deployment and rollback platform.
