# Promo ranking

The authority for the promo ranking on the listing page. Implementation:
`src/lib/ranking/value.ts`; tests: `src/lib/ranking/value.test.ts`.

## Scope

The site ranks individual promos on price and data. It does not publish a
provider "value-for-money" score, because no citable source for coverage or
speed has been agreed (`AGENTS.md` §14). The UI labels the metric for what it
is and never calls a promo the "best".

## Definitions

| Term | Formula |
| --- | --- |
| Price `P` | `priceCentavos ÷ 100` (pesos) |
| Validity `D` (days) | `DAY = n`, `WEEK = 7n`, `MONTH = 30n` |
| Comparable data `G` | `allAccessGb ?? dataGb`, for `TOTAL` promos only |
| **Value** | `(G ÷ P) × 100`, shown as **GB per ₱100** |
| Data per day | `G ÷ D` |
| Price per day | `P ÷ D` |

`G` uses the all-access part when a provider splits data ("20 GB, 8 GB for all
sites" counts as 8 GB), so app-only or 5G-bonus data cannot inflate a score.
Validity cancels out of the value ratio, so it is shown separately as per-day
figures instead of being hidden in one number.

Example: 10 GB all-access for ₱70 over 7 days scores **14.29 GB per ₱100**
(1.43 GB/day, ₱10.00/day).

## Edge cases

| Case | Treatment |
| --- | --- |
| `UNLIMITED`, `NONE` or `UNKNOWN` data | Not scored; shown as "Not comparable" with the reason |
| Unknown validity | Not scored |
| No expiry (`noExpiry`) | Scored on GB per ₱100; per-day figures "Not applicable (no expiry)"; shown as "No expiry", never as unknown |
| Zero or missing price | Not scored |
| App-specific or 5G-only data | Excluded from `G`; still visible in the headline total and notes |
| Ties | Lower price first, then name |
| Unscored promos | Listed after all scored promos, never as a score of 0 |

## Sorting

Current promos come first, then outdated ones (not re-checked for more than 14
days), then promos no longer offered (only when the user includes them). Each
group is sorted the same way:

- `value`: highest GB per ₱100 first (default).
- `price`: lowest price first.
- `data`: most headline data first, unknown last.
- `validity`: no-expiry first, then longest validity, unknown last.

The budget filter applies to price before sorting. Promos that work on both
4G and 5G phones appear under both the 4G and the 5G filter.

## Limitations

1. Price and data only: no coverage or speed.
2. The all-access figure is read from wording such as "N GB for All Sites"; if a
   provider changes it, the value falls back to the total.
3. Prepaid promos only.
4. Values reflect the last check; every promo shows its last-verified date.
5. Compatibility is only known for imported promos. Collected promos stay
   `UNKNOWN`, appear under "Not yet verified", and are left out of the 4G and 5G
   filters.
