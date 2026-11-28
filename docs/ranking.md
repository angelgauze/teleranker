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

## Plan: total cost for your days

The Plan page (`/plan`) orders promos a second way: by what they cost for the
days the visitor needs. It is separate from the value score above and never
changes it. Implementation: `src/lib/compare/needs.ts` (`planForNeeds`, one
promo) and `src/lib/plan/rank.ts` (`rankPlans`, every promo); tests:
`needs.test.ts`, `rank.test.ts`.

### Inputs

| Input | Rule |
| --- | --- |
| Days `N` | Whole days 1–365; defaults to 30 |
| Data per day `d` | Optional, 0.1–50 GB |
| Budget `B` | Optional, ₱1–₱100,000 |
| 4G-only phone | Optional; promos that need a 5G phone are left out |
| Providers | Optional; none means every provider |

### Per promo

The visitor is assumed to buy the promo again each time it expires or its data
runs out; unused data does not carry over and only all-access data `G` counts.

| Term | Formula |
| --- | --- |
| Buys for the days | `ceil(N ÷ D)`; 1 for no-expiry promos |
| Buys for the data | `ceil(N × d ÷ G)` when `d` is given; 1 otherwise or for unlimited data |
| Buys | `max(buys for the days, buys for the data, 1)` |
| Total cost | `buys × P` |
| Total data | `buys × G`; "Unlimited" for unlimited promos |
| Budget fit | `total ≤ B`, with the peso gap either way |

Example: 30 days, ₱70 for 7 days with 10 GB → 5 buys, **₱350**, 50 GB; ₱299
for 30 days → 1 buy, **₱299**.

### Order

1. Promos within the budget first (when a budget is given).
2. Lowest total cost.
3. Fewer buys.
4. More data (unlimited first).
5. Name.

Promos tied on the lowest total are all marked "Lowest cost", and the answer
line says it is a tie instead of naming one.

### Left out or set apart

| Case | Treatment |
| --- | --- |
| Unknown validity, zero or missing price | Not costed; listed under "Can't calculate" with the reason |
| Unknown or missing data amount when `d` is given | Not costed, with the reason |
| `NONE` data (calls and texts only) | Left out, counted in a "Left out" note |
| Needs a 5G phone, with a 4G-only phone | Left out, counted in the note |
| Unverified 4G/5G with a 4G-only phone | Kept, labelled "4G support not verified" |
| Outdated or no longer offered | Not planned; only current promos |

Without `d`, the cheapest promos may include very little data; the page says
so and asks for the daily amount. Coverage and speed are not part of the plan,
and nothing is called "best".

## Limitations

1. Price and data only: no coverage or speed.
2. The all-access figure is read from wording such as "N GB for All Sites"; if a
   provider changes it, the value falls back to the total.
3. Prepaid promos only.
4. Values reflect the last check; every promo shows its last-verified date.
5. Compatibility is only known for imported promos. Collected promos stay
   `UNKNOWN`, appear under "Not yet verified", and are left out of the 4G and 5G
   filters.
