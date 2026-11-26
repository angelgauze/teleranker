# Design notes

**Status: draft.** The theme below is tentative: it was picked to keep the
project moving and may change once the team reviews it. The accessibility,
trust and wording rules come from `AGENTS.md` and are not tentative.

## Principles

1. **Fast on cheap phones.** System font for text, no images except the logo,
   no animation beyond hover and press feedback.
2. **Trust before polish.** Every promo shows when it was checked and where it
   came from. Unknown is never shown as zero. Nothing is called "best".
3. **Plain language.** Short sentences, sentence case, no technical terms.

## Colour

| Use | Colour |
| --- | --- |
| Text, borders, surfaces | Tailwind zinc greys, light and dark mode |
| Brand accent | Amber `#FFB400`: the logo's tallest bar, and future highlights only |
| Healthy status | Emerald text (`emerald-800` / `emerald-300`) |
| Warnings and paused status | Amber text and boxes (`amber-800` / `amber-300`) |
| Errors | Red box (`red-50` / `red-900`) |

- Never use a provider's colour (Globe blue, Smart green, DITO red, TNT
  orange-yellow, GOMO pink and purple). Providers are plain-text badges.
- Colour never carries meaning alone: status, 4G/5G and the current page
  always have a label or underline too.
- Open question: the brand amber and the warning amber are close. If the
  accent is used more widely, warnings may need a different colour.

## Type

- Text: the system font stack in `globals.css`.
- Wordmark only: Montserrat ExtraBold Italic, loaded by `Logo` at build time.
- Page title `text-3xl`, section heading `text-base`/`text-lg`, body
  `text-sm`/`text-base`, notes `text-xs`. One page title per page.

## Logo

- Four slanted bars (greys, tallest in amber) plus the lowercase wordmark
  "teleranker". Source files: `docs/assets/`; component: `Logo`.
- In the header it scales with the screen (12 px wordmark at 320 px, full
  26 px from about 430 px) so the navigation always fits on one row.
- The icons use the bars only. The browser tab and bookmark icon keeps them
  upright so they stay sharp at 16 px; the home-screen icon (180 px) keeps the
  logo's slant.
- Do not recolour the bars or use amber for provider-specific content.

## Layout

- Page widths: listing and provider index `max-w-7xl`, provider detail and
  notices `max-w-3xl`; side padding `px-4`, `sm:px-6`.
- Listing: one card per row on phones, two from `md` (768 px), the table from
  `xl` (1,280 px). No sideways scrolling below 1,280 px.
- Compare: stacked fields with pinned promo names on phones, a table from `md`.

## Components

| Component | Rule |
| --- | --- |
| Primary button | Filled zinc (`bg-zinc-900`, inverted in dark mode). At most one per view |
| Secondary button | Bordered zinc |
| Links | Always underlined, so they show on phones without hover |
| `ProviderBadge` | Uppercase text in a thin border; underlined when it is a link |
| `StatusLabel` | Label plus one or two short detail lines |
| `SourceLink` | Official link, the provider's promo page, or "No source link" |
| Compare tray | Pinned to the bottom while promos are picked |

Keyboard focus is always visible (`focus-visible` outline).

## States

- Loading: grey placeholder blocks, `aria-busy`, no data implied.
- Empty: say what was searched or filtered and what to try next.
- Errors: say what happened; never show raw error text.

## Wording

- Collection status: "Updated automatically", "Update on hold", "Automatic
  updates paused", "Updated manually", "Not published yet".
- Never name the blocking mechanism (no "Cloudflare", "bot challenge" or HTTP
  codes).
- Dates: "Nov 19, 2026", Manila time. Prices: "₱1,299". Missing values:
  "Unknown", "Not verified", "Not applicable" or "Check date unknown",
  never 0 or blank.
- Long explanations become short bullet lists.
- Browser tab titles: `{page heading} · TeleRanker` ("Mobile promos · TeleRanker",
  "DITO · TeleRanker", "Go+109 vs DATA MAXX 70 · TeleRanker", "Page not found · TeleRanker").
