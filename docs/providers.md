# Providers: collection and compliance

How each provider's promos get into TeleRanker, and why. Re-check a provider's
`robots.txt`, terms and page before changing its collector (`AGENTS.md` §7).

## Summary

| Provider | Mode | Source page | Reason |
| --- | --- | --- | --- |
| DITO | Automated | `https://dito.ph/prepaid` | Server-rendered promo cards; `robots.txt` allows the page |
| Globe | Automated, manual import as fallback | `https://www.globe.com.ph/prepaid/promos` | The site answers with a bot challenge, so runs fail safely until it lifts |
| Smart | Manual only | Smart store promo pages | Bot challenge on the main site; terms prohibit automated access |
| TNT | Manual only | Smart store promo pages | Smart brand, same terms as Smart |
| GOMO | Manual only | `https://www.gomo.ph/data-offers` | Full catalogue only exists in page JavaScript |

`termsReviewed` is `false` for every provider until a person signs off its
terms, which is required before scheduled production runs.

## DITO

- `robots.txt` allows `/prepaid`; form, preview and `hsLang` URLs are
  disallowed and never requested.
- Each card (`div.card-universal-layout`) becomes one promo. Cards without a
  published price (`PLAY IT`, `LIVE IT`, `WORK IT`) are skipped; no price is
  guessed.
- "Unlimited 5G" cards with a separate 4G allowance are stored as `UNLIMITED`,
  with the allowance kept in `dataNotes`, so they are not scored on an invented
  GB figure.

## Globe

- The site answers every request, including `robots.txt`, with a bot challenge
  (HTTP 403). The fetcher stops on any `robots.txt` failure other than 404/410,
  so the run fails safely, alerts and publishes nothing. The challenge is never
  worked around (no browser user agent, headless browser or cookie replay).
- The collector stays registered as automated. Meanwhile Globe promos come from
  the manual import; once a run succeeds again, it replaces the hand-entered set
  (see [Maintenance](#maintenance-runs-on-hold-and-errors) for the safety check).
- When the page was reachable: `robots.txt` allowed `/prepaid/promos`
  (faceted `?f[` URLs, `/content/` and `/search/` are disallowed). Cards
  (`section-b2c-promo__card-list`) give the name in `.card-title`, a headline
  such as `20 GB Data | ₱99/7 Days`, and inclusions as `<li>`; the all-access
  figure comes from the `N GB for All Sites` line. "Globe Starlink" cards are
  skipped because satellite data is not comparable with mobile data.

## Smart and TNT

- The main site answers with a JavaScript bot challenge and its `robots.txt`
  cannot be read. Bypassing access controls is prohibited (`AGENTS.md` §2, §7).
- Smart's Terms of Use require users not to access the site with any robot,
  spider, scraper or other automated means. This applies regardless of
  `robots.txt`.
- The Smart store (`https://store.smart.com.ph/promos-and-add-ons/`) lists
  Smart and TNT promos and its `robots.txt` allows those paths, but the terms
  above still apply, and its promo cards only load through ad-tracking links, so
  a collector would be neither permitted nor reliable.
- Both are `manual-only`: the CLI refuses to collect them. The team compiles
  their promos from the store pages into the manual import sheet. TNT is its own
  provider.

## GOMO

- No `robots.txt` (404, treated as no rules) and no bot challenge.
- Only 8 featured offers are server-rendered, mixing mobile data, no-expiry,
  roaming and fiber. The full catalogue exists only in the page's JavaScript
  state, which collectors may not run, and some offers are app-only.
- `manual-only`: an automated run would only see the featured subset and
  misrepresent the catalogue.

## Manual import

For Smart, TNT and GOMO, and for Globe while its runs fail. The team transcribes
promos from the official pages into a spreadsheet kept **outside this
repository**, exports the "Promos" sheet as CSV, and loads it:

```bash
pnpm import:promos --file=<path.csv>                   # validate only
pnpm import:promos --file=<path.csv> --publish         # write to the database
pnpm import:promos --file=<path.csv> --publish --replace-collected
```

- Every row passes `promoInputSchema`. If any row fails, nothing is written and
  each error is printed with its line number.
- `brand_id` must be a provider registered in `src/lib/collect/registry.ts`.
- All providers in the file are written in one transaction (all or nothing),
  with origin `MANUAL`. Promos missing from a newer sheet become `UNAVAILABLE`.
- A provider with active collector-published promos is skipped unless
  `--replace-collected` is passed, so a sheet never silently overwrites scraped
  data. Otherwise the most recent publish for a provider wins.
- Contributor names (`verified_by`, `entered_by`), app perks, fair-use figures
  and the sheet's row check are not imported.

Column mapping (`src/lib/manual/promo-sheet.ts`):

| Sheet | Stored as |
| --- | --- |
| `is_unlimited_data = yes` | `UNLIMITED` (not scored) |
| `open_gb` blank | `UNKNOWN` data |
| `open_gb + app_gb = 0` | `NONE` (calls-only promos) |
| `open_gb`, `app_gb` | `dataGb = open + app`; `allAccessGb = open` when app data exists |
| `is_no_expiry = yes` | `noExpiry`: shown as "No expiry", scored on GB per ₱100, no per-day figures |
| `validity_days` | Validity in days; blank means unknown |
| `network_support = 5G` | `FIVE_G` (needs a 5G phone) |
| `network_support = 4G` or `4G/5G` | `FOUR_G_AND_FIVE_G` (works on any LTE phone) |
| `calls`/`texts = unli_allnet` | Unlimited |
| `calls`/`texts = none` | `0` (explicitly none) |
| `calls = limited` | Limited, with `calls_minutes`; texts have no count column, so the count stays unknown |
| `unli_onnet` or blank | Unknown (on-net-only unlimited cannot be stored yet) |
| `last_verified_at` | `YYYY-MM-DD` or an Excel date number, midnight Manila time; must be between 2020-01-01 and the import day |
| `source_url` | Official link. Without one, the row links to the provider's general promo page (`promoPageUrl`), labelled as such |
| `notes` | Promo description |

## Checked values on collected promos (overrides)

For 4G/5G compatibility that a collector leaves "Not verified" (all DITO
promos). The sheet is kept **outside this repository**, and every published run
re-applies the stored values.

```bash
pnpm overrides:template --provider=dito --out=<path.csv>   # pre-filled sheet
pnpm import:overrides --file=<path.csv> [--publish]        # validate (and save)
```

- Fill `network_support` (`4G`, `4G/5G` or `5G`), `verified_at` and
  `source_url` for checked promos; blank rows are ignored. Rows match by
  `promo_id`.
- Automated providers only (DITO, Globe). Nothing is saved if any row is
  invalid; deleting a row returns the promo to the collector's value.
- The checked value wins. Unmatched rows and conflicts with the collector are
  listed in each run's log; conflicts also raise an alert.

## Collector rules

Enforced in `src/lib/collect/http.ts` and `robots.ts`:

- HTTPS only. `robots.txt` is read once per origin and enforced before every
  request; 404/410 means no rules, any other failure stops the run.
- One request per source page per run, at least 2 seconds apart per host.
- Identifies as `TeleRankerBot/0.1`, plus `SCRAPER_CONTACT` if set.
- 15 s timeout, 2 MB response cap, at most one retry on 5xx or network errors.
- No JavaScript rendering, authentication, CAPTCHA solving, rate-limit
  circumvention or undocumented internal APIs.

## Maintenance: runs on hold and errors

For the admin or maintenance team.

**Why a run is held back.** A run publishes only if it collected records,
rejected at most half of them, and kept at least half of the baseline:

- the number of promos the provider's last successful published run accepted;
- or, if no run has ever published for the provider (Globe today), the number of
  hand-entered promos currently listed.

The second rule stops a broken first run, for example after a redesign, from
replacing a full hand-entered catalogue with a handful of promos. A held-back
run changes nothing: the listing keeps the previous details and shows "Update
on hold", the run is recorded with `published = false`, and an alert gives the
reason, such as `record count dropped to 8% of the published set (3 of 36)`.

**What to do.**

1. Open the provider's promo page in a browser and count its promos.
2. If the provider really lists fewer promos, publish the smaller set on
   purpose:

   ```bash
   pnpm scrape --provider=globe --live --publish --accept-smaller-set
   ```

   This needs `--publish` and a single `--provider`, and only skips the "kept
   at least half" check. The override is kept in the run log
   (`ScrapeRun.rawPayload.override`) and a warning alert is sent once the set is
   published.
3. If the page lists about as many promos as before, the parser is broken. Do
   not use the flag: refresh the fixture, fix the collector and its tests, and
   keep the hand-entered set meanwhile.

**Error messages** (`src/lib/db/errors.ts`):

| Message | Usual cause |
| --- | --- |
| Database login failed (check DATABASE_URL in .env) | Wrong user or password in `.env` |
| Database server could not be reached | PostgreSQL is not running, or wrong host/port |
| Database does not exist (check DATABASE_URL in .env) | Database in `.env` not created |
| A database table/column is missing (run pnpm db:migrate) | Migrations not applied |

`unexpected error: …` points to a bug, not the database, and the CLIs print
its stack trace.

**Publishing is all or nothing.** A run's promos and its run log are saved in
one transaction, and so is a whole manual import. If the database drops
part-way, nothing changes.

## Before scheduled production runs

1. A person reviews each provider's terms and sets `termsReviewed`.
2. Decide where the weekly job runs and how alerts are delivered (`AGENTS.md` §14).
3. When a provider redesigns its page, refresh its fixture and re-run the tests.

## Adding a provider

1. Find the official promo page.
2. Read its `robots.txt` and terms, and record the finding here and in
   `src/lib/collect/registry.ts`.
3. If automated collection is blocked or not permitted, register it as
   `manual-only` with the reason.
4. Write `src/lib/collect/collectors/<provider>.ts`, exporting a parser
   (`html -> PromoDraft[]`) and a `ProviderCollector`.
5. Save a trimmed HTML fixture with a provenance comment, and add parser tests.
6. Keep provider-specific parsing inside `collectors/`.

## Commands

```bash
# Parse a saved page (no network, no database)
pnpm scrape --provider=dito --fixture=src/lib/collect/collectors/fixtures/dito-prepaid.html

# Fetch and validate only
pnpm scrape --provider=all --live

# Fetch, validate and publish (requires DATABASE_URL)
pnpm scrape --provider=all --live --publish
```

The exit code is non-zero when a run fails or is held back, so a scheduler can
alert on it.
