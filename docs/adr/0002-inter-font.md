# ADR 0002 — Inter as the interface font

- **Status:** Accepted, 2026-11-28

## Context

`docs/DESIGN.md` sets a clean, dense, number-heavy interface: prices, GB and
per-day figures in aligned columns. Until now the site used the operating
system's font, which differs per device (SF Pro, Segoe UI, Roboto), so spacing,
weights and figure widths change from phone to phone. `CLAUDE.md` asks for an
ADR whenever a web font is added, because it changes the stack.

How a web font changes the stack:

| Area         | Without a web font          | With Inter through `next/font/google`                                                                                              |
| ------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Build        | No network needed for fonts | The build downloads the font files from Google Fonts once; an offline build needs a cached copy                                    |
| Runtime      | Nothing extra to load       | The font is **self-hosted** with the site's own files (no request to Google from visitors), one variable file for the Latin subset |
| Page weight  | 0 KB                        | About 50–100 KB on a first visit, then cached                                                                                      |
| First paint  | Text in the system font     | Text shows at once in a size-matched system fallback (`display: swap`), then switches; no layout jump                              |
| Dependencies | —                           | None added: `next/font` ships with Next.js                                                                                         |
| Licence      | —                           | Inter is under the SIL Open Font License 1.1 (free to use and self-host)                                                           |
| Privacy      | —                           | Visitors' browsers never contact Google; nothing is logged about them                                                              |

## Decision

Use **Inter** (variable, weights used 400–590) for all interface text, loaded
through `next/font/google` with the Latin subset and `display: swap`, exposed
as the `--font-inter` variable in `src/app/layout.tsx`. The system font stack
stays as the fallback. The logo's wordmark keeps Montserrat, as before.

## Alternatives considered

1. **System fonts only.** Zero cost, but inconsistent widths and weights across
   devices, and some Android fonts lack tabular figures.
2. **Geist** (Vercel's font). Similar quality; Inter has wider language
   coverage, more mature tabular figures and alternates, and was the font used
   in the reviewed mockups.
3. **Self-hosting font files in the repository.** Same result as `next/font`
   but manual: more files to maintain and no automatic fallback metrics.

## Consequences

**Positive:** the same type on every device; reliable tabular figures for
price columns; no extra request to a third party at runtime.

**Negative / risks:** builds need network access the first time (or a cached
copy); roughly 50–100 KB more on a first visit, inside the 3–5 s page budget;
one more thing to keep within the performance budget in `docs/DESIGN.md`.

**Reversible:** removing the `Inter` import from `layout.tsx` falls back to the
system font with no other change.
