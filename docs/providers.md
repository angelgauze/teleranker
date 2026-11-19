# Provider collection and compliance

Every collector decision is recorded here with the evidence behind it and a
date, so it is re-checked rather than assumed (`AGENTS.md` §7).

Checked on **2026-11-19** from this environment.

## Summary

| Provider | Mode | Source | robots.txt | Notes |
| --- | --- | --- | --- | --- |
| Globe | Automated | `https://www.globe.com.ph/prepaid/promos` | Allowed | Server-rendered cards |
| DITO | Automated | `https://dito.ph/prepaid` | Allowed | Server-rendered cards |
| Smart | **Manual entry only** | — | Unreadable | Bot-protection challenge |

## Globe

- `https://www.globe.com.ph/robots.txt` → HTTP 200. `/prepaid/promos` is not
  disallowed. Faceted URLs (`/*?*f[*`) and `/content/`, `/search/` are
  disallowed and are never requested.
- `https://www.globe.com.ph/prepaid/promos` → HTTP 200, server-rendered HTML
  containing `section-b2c-promo__card-list` cards.
- 9 cards found: 7 mobile promos collected, 2 "Globe Starlink" promos skipped
  because satellite-only data is not comparable with mobile data.
- Card shape: `.card-title` for the name, a headline `p.card-text` such as
  `20 GB Data | ₱99/7 Days`, and `<li>` inclusions. The all-access figure comes
  from the `N GB for All Sites` line.

## DITO

- `https://dito.ph/robots.txt` → HTTP 200. `/prepaid` is not disallowed.
  Form, preview and `hsLang` URLs are disallowed and are never requested.
- `https://dito.ph/prepaid` → HTTP 200, server-rendered cards
  (`div.card-universal-layout`).
- 39 cards found: 36 collected, 3 skipped (`PLAY IT`, `LIVE IT`, `WORK IT`)
  because they publish no price. No price is ever guessed.
- Cards that sell "Unlimited 5G" plus a separate 4G allowance are stored as
  `UNLIMITED` with the allowance kept in `dataNotes`, so they are not scored on
  an invented GB figure.

## Smart — why collection is disabled

- `https://smart.com.ph/robots.txt` redirects to a 404 page that returns HTML,
  so no rules could be read.
- `https://smart.com.ph/Pages/promos` does not return promo content. It returns
  an obfuscated JavaScript challenge (`HTTP 247`), which is an access control.
  `AGENTS.md` §7 and §2 explicitly prohibit bypassing access controls,
  CAPTCHAs or similar restrictions, so building a collector around it is out of
  scope.
- **Action:** Smart promos must be entered or overridden by an administrator.
  The registry marks the provider `manual-only` and the CLI refuses to collect
  it.

## What the collectors do and do not do

Enforced in code (`src/lib/collect/http.ts`, `robots.ts`):

- HTTPS only; `robots.txt` fetched once per origin and enforced before every
  request; 404/410 robots is treated as "no rules", any other failure aborts.
- One request per source page per run, spaced by at least 2 seconds per host.
- Identifies itself with `TeleRankerBot/0.1` plus `SCRAPER_CONTACT` if set.
- 15 s timeout, 2 MB response cap, at most one retry on 5xx or network errors.
- No JavaScript rendering, no authentication, no CAPTCHA solving, no rate-limit
  circumvention, no use of undocumented internal APIs.

## Outstanding work before scheduled production runs

1. **Terms of use review.** `termsReviewed` is `false` for every provider. A
   person must read each provider's terms before the job is scheduled; the
   registry field exists so this cannot be forgotten silently.
2. **Schedule and alert channel.** Not decided (`AGENTS.md` §14).
3. **Fixture freshness.** The regression fixtures capture the 2026-11-19 markup.
   When a provider redesigns its page, refresh the fixture and re-run the tests.

## Adding a provider

1. Find the official promo page and record its URL.
2. Read `robots.txt` and the provider's terms; record the finding in this file
   and in `src/lib/collect/registry.ts`.
3. If automated collection is blocked or not permitted, register the provider
   as `manual-only` with the reason.
4. Write the collector in `src/lib/collect/collectors/<provider>.ts` exporting a
   parser (`html -> PromoDraft[]`) and a `ProviderCollector`.
5. Save a trimmed HTML fixture captured from the page, with a provenance
   comment, and add parser tests.
6. Search for provider-specific parsing anywhere outside `collectors/` — there
   should be none.

## Commands

```bash
# Parse a saved page (no network, no database)
pnpm scrape --provider=dito --fixture=src/lib/collect/collectors/fixtures/dito-prepaid.html

# Fetch and validate only
pnpm scrape --provider=all --live

# Fetch, validate and publish (requires DATABASE_URL)
pnpm scrape --provider=all --live --publish
```

Exit code is non-zero when a run fails or is blocked, so a scheduler can alert
on it. Every run is written to `ScrapeRun` when `--publish` is used; a blocked
run keeps the previous published set untouched.
