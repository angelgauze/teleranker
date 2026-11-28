# Design

How TeleRanker looks and behaves. The colour tokens live in
`src/app/globals.css`; this document explains how to use them. The
accessibility, trust and wording rules come from `AGENTS.md`.

## Direction

TeleRanker is one place to see, compare and plan around every Philippine
provider's prepaid promos, for people on the go and on small data plans, on
phones first.

The look is clean, minimal and dense but calm: monochrome greys, crisp 1px
borders, precise type, and pages built section by section (a heading on the
left, its content on the right, thin rules between sections).

What makes it TeleRanker:

- **Pesos first.** Prices and totals are the biggest numbers; GB per ₱100 is
  the brightest number on every listing row.
- **Provenance is a feature.** Every promo shows when it was checked and its
  source; every provider shows its update label and promo page.
- **Honest comparison.** Differences are marked (↑ ahead, ≠ different, = same,
  ? unknown); unknown is never zero; nothing is called "best".

## Principles

1. **Fast on cheap phones.** No images except the logo; no blur on phones;
   motion only for hover, press and sheets.
2. **Trust before polish.** Checked dates and sources are always visible.
3. **Plain language.** Short sentences, sentence case, no technical terms.
4. **One layout, folded.** Phones get the desktop layout folded (two columns
   to one, toolbars to stacks, dialogs to sheets), not a second design.
5. **Results first.** Controls that browse or filter start from a sensible
   default and apply live, so a page answers before anything is touched; they
   have no submit button. Anything that creates or changes data (a review, an
   admin decision) is the opposite: it waits for an explicit button press.

## Performance budget

| Cost                   | Rule                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fonts                  | Inter (variable, Latin) and the logo font, both self-hosted through `next/font`, with the system font shown until loaded |
| Images                 | None except the logo (inline SVG); icons are inline SVG                                                                  |
| Blur and large shadows | Desktop only                                                                                                             |
| Lists                  | Rendered on the server in batches: 24 on the listing, 5 on Plan                                                          |
| Motion                 | CSS only; stops under reduced motion                                                                                     |

## Colour

Dark only for now; do not invent light-theme values.

| Token            | Use                                                                         |
| ---------------- | --------------------------------------------------------------------------- |
| `canvas`         | Page background, the pinned header and toolbar                              |
| `surface`        | List containers, fields, secondary buttons, pills, summary and notice boxes |
| `panel`          | The Compare pop-up's background                                             |
| `band`           | Rows where one promo is ahead, and the lowest-cost Plan rows                |
| `raised`         | Budget box, ticked rows, the compare bar, menus and popovers                |
| `selected`       | Selected segments and chips, the current nav tab, tags                      |
| `line-soft`      | Section and row dividers, bar tracks                                        |
| `line`           | Container, field and pill borders                                           |
| `line-strong`    | Hovered fields, badges, outlined buttons, popovers                          |
| `fg`             | Primary text, the primary button's fill                                     |
| `fg-2`           | Secondary text, the price-range bar's fill                                  |
| `fg-3`           | Helper lines, unselected segments, badge text                               |
| `fg-4`           | Notes, labels, counts, placeholders, matching values in Compare             |
| `peak` (`white`) | The brightest number per row, the value that is ahead                       |

- **Color only in the logo.** Better values are brighter, bolder and tagged
  ("₱29 less"), never coloured.
- **Never colour alone.** Status is an icon plus a written label (`StatusMark`:
  filled dot = updated automatically, hollow dot = updated manually, pause
  icon = automatic updates paused).
- **No provider colours.** Providers are plain-text badges.
- Popovers and sheets share a near-black backdrop at 60% (70% for the Compare
  pop-up). Focus outlines use `fg-2`.

## Type

- **Inter** for all interface text, with the operating system's UI font as the
  fallback. The logo's wordmark is Montserrat ExtraBold Italic.
- **Weights stop at 590.** 560 for page titles (large type reads heavy); 590
  for headings, promo names and key numbers; 500 for labels, buttons and
  badges; 400 for body. Write `font-[590]`, never `font-semibold` or bolder.
- **Tabular figures** for every number, so columns line up.
- **Scale:**

| Role                   | Size                                                    |
| ---------------------- | ------------------------------------------------------- |
| Page title             | 56px desktop, 28px phones, 560, -0.035em, at most two lines |
| Intro beside the title | 20px desktop, 15px phones, `fg-2`                       |
| Section heading        | 24px desktop, 20px phones, -0.02em                      |
| Dialog title           | 17px                                                    |
| Body                   | 14px; helper lines 13–14px `fg-3`; notes 12–13px `fg-4` |
| Promo name             | 15px 590 (13px in tight table headers)                  |
| Big numbers            | 22–24px 590 (prices, totals, counts)                    |
| Labels                 | 13px 500                                                |
| Badges and tags        | 11px                                                    |

## Logo

Four slanted bars (greys, the tallest amber) and the lowercase wordmark
"teleranker" (`Logo`; files in `docs/assets/`). The header uses size 20. Icons
use the bars only, upright at 16px. Never recolour the bars.

## Layout

### Page frame

A centred column at most 1200px wide, with 16px gutters on phones and 24px
from `sm`. Every main page opens with the title on the left and the intro on
the right (two equal columns from `md`, 48px gap). Sections below reuse the
same two columns, so content always starts where the intro does. Breakpoints:
`sm` 640px, `md` 768px, `lg` 1024px.

### Header

Pinned on every page, solid `canvas`, 56px (60px from `sm`). Logo on the left;
on the right the page links (Promos, Providers, Plan), a thin rule, then a
**Help** menu (How value is calculated, About 4G and 5G, What the update labels
mean). The current page has the `selected` fill and `aria-current`. On phones
everything folds into a menu button. Bars pinned below the header offset by its
height.

### Promos listing

- A toolbar pinned under the header from `sm`: budget box, search, validity
  switch, Filters. Changes apply live and update the address.
- The Filters sheet holds providers (several at once), phone type, lowest price
  and "include no longer offered"; its button reports the live count ("Show 36
  promos").
- Removable filter pills; a results bar with the count and Sort.
- A dense table from `lg`; cards on phones. "Show 24 more" below.
- Help sections at the bottom: heading left; a lead sentence and labelled rows
  right.

### Compare

- Opens as a pop-up once two promos are picked: a centred 780px dialog on
  desktop, a full-height sheet on phones. Its address is the full page's
  (`/compare?id=…&id=…`), so a direct visit or reload opens the full Compare
  page with the same content.
- A slim title bar; the summary (one ↑ line per promo with what it does better,
  then ≠, = and ? lines); the **All fields / Differences** switch with "My phone
  is 4G only"; then the table.
- Table: labels left, one column per promo, names and prices pinned, ✕ Remove in
  each column header (pop-up only). Rows where one promo is ahead are banded,
  with its value bold white and tagged; matching values are `fg-4`. Source is
  the last row. Phones open on Differences.
- Ends with the scope footnote and **Plan for your needs →**.
- The full page uses the page width, a two-line title ("Compare / promos") and
  a quiet "← Back to promos" link right after the table; its messages (no
  pair, a missing promo) use the standard title and intro.

### Plan

- Three steps as sections, each with a "Step 1" label, heading and helper line:
  1. **Providers** (or, coming from Compare, **Promos**: These two | All promos)
  2. **Days you need data for**: 7, 15, 30 or Other, starting at 30
  3. **Your usage**: data per day, budget, "My phone is 4G only"
- **Results**: a one-line answer (ties stated as ties), then promos by total
  cost, 5 at a time, each with buys, total data and budget fit. Promos that can't
  be costed are set apart with their reason. With a pair, a Compare-style table.
- The assumptions sit in a footnote at the bottom.

### Providers

- One section per provider. Left: the name, the update label and its promo page
  link, then each status note on its own line. Right: the price range on a
  scale shared by every provider (logarithmic, so ₱10, ₱100 and ₱1,000 are
  evenly spaced), current promos, how many need a 5G phone, and **See N promos
  →** at the right edge.
- "What the update labels mean" at the bottom.
- Old provider links (`/providers/dito`) redirect to that provider's section.

## Depth and shape

- Flat at rest; depth comes from the grey steps (`canvas` → `surface` →
  `panel` → `band` → `raised` → `selected`) and 1px borders.
- Shadows, black, only on floating things: the Compare pop-up, the compare bar,
  the Filters sheet, menus and the back-to-top button. None on phones.
- Corners: 6px badges and segments; 8px fields and buttons; 10–12px boxes, lists
  and popovers; 14px the Compare dialog; 16px sheets; round for pills and bars.

## Components

| Component        | Rule                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Primary button   | `fg` fill, `canvas` text, white on hover. At most one per view                                     |
| Confirm button   | `selected` fill with an `fg-3` border ("Show 36 promos")                                           |
| Outlined button  | Transparent with a `line-strong` border ("See 36 promos →", "Show 5 more")                         |
| Secondary button | `surface` fill, `line` border ("Show 24 more", Filters)                                            |
| Fields           | 40px (44px on phones), `surface`, `line` border; number boxes without spinners, units in the label |
| Budget box       | The only `raised` field, with "Budget ₱" inside                                                    |
| Segmented switch | Segments in a bordered track; selected is `selected` and 590                                       |
| Toggle chips     | Bordered, highlighted when on, no check marks                                                      |
| Sheets and menus | Native popovers; bottom sheets on phones                                                           |
| Filter pills     | Round, `surface`, with a small ✕                                                                   |
| Value bar        | 64 × 4px, `fg-4` fill relative to the top GB per ₱100 shown                                        |
| Price-range bar  | 8px track with a tick at each power of ten, `fg-2` fill                                            |
| Summary box      | `surface`, one line per point with ↑ ≠ = or ?                                                      |
| Compare table    | Columns 30% / 35% / 35%; banded rows; tags                                                         |
| Compare bar      | Floats at the bottom, `raised`, both names, Clear and Compare                                      |
| Back to top      | 44px round button, bottom right, after one screen                                                  |
| Links            | Underlined; external links end in ↗                                                                |
| `ProviderBadge`  | Uppercase 11px text in a thin `line-strong` frame                                                  |
| `SourceLink`     | The promo's source, the provider's promo page (with a note), or "No source link"                   |

Tap targets are at least 44px on phones. Keyboard focus is always visible.

## Forms

For anything that sends data, such as a review. Browsing controls follow the
listing and Plan instead.

- **Layout:** one column, at most 34rem wide, inside the page's right column
  (the section pattern). Labels sit above their field: 13px, 500, `fg-2`.
  Optional fields say "· optional" after the label in `fg-4`.
- **Text area:** the field style, at least 6 rows, resizable vertically only.
  A counter under it on the right ("212 / 400") in `fg-4`, turning `fg` once
  past 90%. Never let the count go negative; stop input at the limit.
- **Validation:** check on submit and on leaving a field, not on every key. The
  message sits under the field in `fg-2`, the field's border turns `fg-2`, and
  the field gets `aria-invalid` plus `aria-describedby` pointing at the message.
  No red. The server validates again with the same Zod schema; its messages use
  the same spot.
- **Submit:** one primary button at the end, labelled with the action ("Post
  review"), not "Submit". While sending it reads "Posting…" and is disabled.
  A secondary "Cancel" text link may sit beside it.
- **After sending:** replace the form with a short confirmation in a `surface`
  box with a ✓ icon ("Thanks. Your review will appear once it has been
  checked." when reviews are moderated, "Thanks. Your review is posted."
  otherwise), plus a link back.
- **Reviews in particular:** the name is optional and a blank name shows as
  "Anonymous"; the body is 1–400 characters after trimming (the schema in
  `src/lib/schema/review.ts`). Show each review's date like other dates, never
  the reviewer's private data.

## Admin

The admin panel is a working tool: dense, desktop-first, the same tokens and
header, no marketing copy. It still works on phones (rows fold into cards).

- **Queue:** a table like the listing's: one row per item with its key facts
  (provider, name or "Anonymous", the review text, date) and its actions at the
  right edge. A filter switch above it (Pending, Accepted, Rejected) uses the
  segmented switch and shows counts ("Pending 12").
- **Status:** an icon plus a written label, like update labels: hollow dot =
  Pending, filled dot = Accepted, ✕ = Rejected. Never colour alone.
- **Actions:** "Accept" is an outlined button; "Reject" is a plain text button
  next to it. A destructive or hard-to-undo action (reject, delete) opens a
  small confirmation that names the item and says what happens ("Reject this
  review? It will not be shown."), with the action as the primary button and
  "Cancel" beside it. No red: the wording and the confirm step carry the weight.
- **Feedback:** after an action the row updates in place and a one-line status
  appears above the table ("Review rejected."), announced to screen readers.
  Offer "Undo" when the action can be reversed.
- **States:** loading uses placeholder rows; an empty queue says so plainly
  ("No reviews waiting."); errors use the notice box with "Try again".
- **Access:** every admin page and action checks authorization on the server;
  the UI never hides a control as the only protection.

## States

- **Loading:** grey placeholder blocks in the page's own shape, `aria-busy`, no
  data implied. Each main page has its own.
- **Empty:** say what was searched or filtered and what to try next.
- **Errors:** say what happened, never raw error text; offer "Try again" where
  it helps.
- **Not found and unexpected errors:** bare pages with no site header (mark
  `<main data-bare>`): a small centred heading, one line of explanation and a
  way back ("Back to promos"; "Try again" first on the error page).

## Wording

- Update labels: "Updated automatically", "Update on hold", "Automatic updates
  paused", "Updated manually", "Not published yet". Never name the blocking
  mechanism.
- Dates "Nov 19, 2026" (Manila time); prices "₱1,299". Missing values:
  "Unknown", "None", "Not verified" or "Not applicable", never 0, blank or a bare
  dash.
- Headings speak to the user ("Plan for your needs", "Your usage"); first person
  only for what the user states ("My phone is 4G only").
- Tab titles: the nav name for main pages ("Promos · TeleRanker"), otherwise the
  page's subject ("DATA MAXX 70 vs DATA MAXX 149 · TeleRanker").
- Buttons name the action ("Post review", "Accept", "See 36 promos"), never
  "Submit", "OK" or "Click here".

## Building pages

Rules for code that follows this design:

- **Tokens only.** Use the colour classes from `globals.css` (`bg-surface`,
  `text-fg-3`, `border-line`…), never Tailwind's `zinc`, `gray`, `white` or
  `black` scales (the one exception: `text-white` for the value that is ahead).
- **Weights.** `font-[560]` for page titles, `font-[590]` for headings and key
  numbers, `font-medium` (500) for labels; never `font-semibold` or bolder.
- **Numbers.** Pages full of figures add `tabular-nums` on `<main>`.
- **Page start.** Copy the opening of `src/app/providers/page.tsx`: the
  `<main>` container, then the title and intro grid. Sections use `PlanStep`
  (`src/app/_components/plan-step.tsx`), which fits any page despite its name.
- **Pinned header.** Anything else pinned to the top sits below it:
  `top-14 sm:top-15`. Anchored headings add `scroll-mt-20 sm:scroll-mt-24`, and
  pages with anchors render `HashScroll` so links from other pages land.
- **Links.** Use `next/link` for in-site links, except links out of the Compare
  pop-up and links to a section on another page, which are plain `<a>`.
- **Phones.** Check at 390px wide: no sideways scroll, tap targets at least
  44px, no blur.
- **Reuse.** `ProviderBadge`, `StatusMark`, `SourceLink`, `HashScroll`,
  `RetryButton` and the class constants in `compare-table.ts` already exist.
