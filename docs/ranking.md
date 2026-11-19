# Promo ranking

This document is the authority for the promo-level ranking shown on the listing
page. The implementation is `src/lib/ranking/value.ts`; its tests are
`src/lib/ranking/value.test.ts`.

## Scope

The site ranks **individual promos** on a value metric built from measurable
fields. It does **not** publish a provider "value-for-money" score that
includes coverage or speed: no reliable, citable source for those two criteria
has been agreed yet (see `AGENTS.md` §14). Presenting a price-only number as if
it were the complete provider ranking would violate the requirement in
`AGENTS.md` §3. The UI therefore labels the metric for what it is.

## Inputs

| Field | Meaning |
| --- | --- |
| `priceCentavos` | Price in integer centavos (₱70 is `7000`) |
| `dataKind` | `TOTAL`, `UNLIMITED`, `NONE` or `UNKNOWN` |
| `dataGb` | Headline allowance, only for `TOTAL` |
| `allAccessGb` | All-network part of `dataGb`, when the provider splits it |
| `validityValue`, `validityUnit` | Raw validity as published (`7 DAY`, `1 MONTH`, ...) |

## Definitions

- **Price** `P = priceCentavos ÷ 100` (pesos).
- **Validity in days** `D`: `DAY = n`, `WEEK = 7n`, `MONTH = 30n`.
  A 30-day month is an assumption; prepaid promos are sold in 30-day chunks.
- **Comparable data** `G = allAccessGb ?? dataGb`, for `TOTAL` promos only.
  When a provider sells "20 GB" of which 8 GB works on all sites, the
  comparison uses 8 GB so app-specific or 5G-bonus data cannot inflate a score.
- **Data per day** `= G ÷ D` (GB/day).
- **Price per day** `= P ÷ D` (₱/day).
- **Value** `= (G ÷ P) × 100`, shown as **"GB per ₱100"**.

Validity cancels out of the value ratio:

```
(G ÷ D) ÷ (P ÷ D) = G ÷ P
```

so validity is reported separately (per-day figures) rather than being hidden
inside one opaque number.

## Worked examples

| Promo | Data used | Price | Validity | Value | Per day |
| --- | --- | --- | --- | --- | --- |
| DATA MAXX 70 | 10 GB all-access | ₱70 | 7 days | 14.29 GB per ₱100 | 1.43 GB/day, ₱10.00/day |
| Go+99 | 8 GB all-access (of 20 GB headline) | ₱99 | 7 days | 8.08 GB per ₱100 | 1.14 GB/day, ₱14.14/day |

## Edge cases

| Case | Treatment |
| --- | --- |
| `UNLIMITED` | Not scored. No GB figure is invented; the UI says "Not comparable". |
| `NONE` / `UNKNOWN` data | Not scored. |
| Unknown validity | Not scored (no per-day figure is possible). |
| Price is zero or missing | Not scored, to avoid dividing by zero. |
| App-specific / 5G-only data | Excluded from `G`; remains visible in `dataNotes` and the headline total. |
| Missing `allAccessGb` | Falls back to `dataGb`; the UI does not claim an all-access split that was never published. |
| Ties | Lower price first, then promo name. |
| Unscored promos | Sorted after every scored promo, never treated as a score of 0. |

## Sorting

`sort` query values map to:

- `value` — descending GB per ₱100 (default).
- `price` — ascending price.
- `data` — descending headline data (`null` last).
- `validity` — descending validity in days (`null` last).

Budget filtering happens on `priceCentavos` before sorting. Compatibility
filtering matches dual-network promos for both the 4G and the 5G options.

## Limitations

1. **No coverage or speed.** The metric covers price and data only. The UI must
   not describe the top promo as the "best" overall.
2. **All-access data is a parser heuristic.** It comes from phrases such as
   "N GB for All Sites" (Globe) or "N GB all-access" (DITO). If a provider
   changes wording, the value falls back to the total and the parser warning is
   logged; the change is visible in `dataNotes`.
3. **Prepaid only.** Both collectors currently read prepaid promo pages.
4. **Point-in-time snapshot.** Values describe the last verified scrape. Prices
   change; `lastVerifiedAt` is shown on every row.
5. **Unverified compatibility.** Collected promos are stored with
   `UNKNOWN` compatibility because the definition of a promo's 4G/5G support is
   still an open decision. They are therefore excluded from compatibility
   filters until an administrator verifies them.

## Tests

`src/lib/ranking/value.test.ts` covers unit conversion, the all-access fallback,
unlimited promos, unknown validity, zero price, ordering, tie-breaks and
nulls-last behaviour.
