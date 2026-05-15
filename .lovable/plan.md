# Custom code → library migration recommendations

After auditing `src/lib`, `src/hooks`, `src/generators` and `src/components`, the codebase is overall lean and most "utilities" are domain-specific (financial rules, embarque mappers, Mexican locale fixes) — those should stay. Below are the candidates where a well-known dependency would meaningfully reduce maintenance, plus the cases where I recommend **keeping** the in-house code.

Each row lists: what we have today → suggested library, with pros/cons.

---

## High value (recommend migrating)

### 1. CSV export — `src/generators/exportCsv.ts` (29 lines)

**Today:** Hand-rolled escape + `Blob` + `URL.createObjectURL`.
**Library:** `papaparse` (~45 KB gzip) or `csv-stringify/browser`.
**Pros:** Handles edge cases we don't (UTF-16 BOM variants, custom delimiters, streaming, `null`/`undefined`/dates correctly). Battle-tested by millions of downloads/week.
**Cons:** Adds bundle weight on a feature only used in `Reportes`. Our 29-line version already passes the cases we use.
**Verdict:** Migrate **only if** we add more export targets (Excel) — `xlsx`/`exceljs` then becomes the better umbrella choice. Otherwise keep.

### 2. Phone formatting — `formatPhoneMx` in `src/lib/formatters/index.ts`

**Today:** Manual regex + hard-coded list of 2-digit `LADAS_2_DIGITOS` (CDMX/MTY/GDL).
**Library:** `libphonenumber-js` (~145 KB gzip, or 35 KB for the `min` build covering only MX).
**Pros:** Correct for every MX area code (we currently get the rest wrong by assuming 3-digit), validates, supports international entries from contactos extranjeros, future-proof if we onboard non-MX clients.
**Cons:** Bundle size (mitigatable with the metadata-min build). One more dep to track.
**Verdict:** **Migrate** with `libphonenumber-js/min` — biggest correctness win in the list.

### 3. PDF generation — `src/generators/cotizacionPdf.ts`, `proformaPdf.ts` (520 lines combined)

**Today:** Build an HTML string and call `window.open() + window.print()`. User then chooses "Save as PDF" in the browser dialog.
**Library:** `jspdf` + `jspdf-autotable`, or `@react-pdf/renderer`, or server-side via Lovable Cloud edge function with `puppeteer`/`pdfmake`.
**Pros:** Real `.pdf` file downloads (no print dialog), consistent rendering across browsers, works on mobile (current flow is broken on iOS Safari), can attach to emails/storage automatically.
**Cons:** `jspdf` ≈ 350 KB gzip; `@react-pdf/renderer` ≈ 250 KB but rewrite of layout. Edge-function approach avoids client bundle but adds latency and cold-start cost.
**Verdict:** **Migrate** if we want shareable PDFs (cliente portal, email attachments). Recommended path: `@react-pdf/renderer` for best maintainability, OR an edge function with `pdfmake` if PDFs need to live in Storage.

### 4. URL search-param state — `useListPageState` + every list page

**Today:** Local `useState` for `search`, `page`, `pageSize`, `filters`. Filters disappear on refresh and aren't shareable.
**Library:** `nuqs` (~3 KB gzip).
**Pros:** Bookmarkable/shareable URLs ("send me the link to embarques filtered by Q1 2026 + cliente X"), survives refresh, plays nicely with `react-router-dom` v6 already installed.
**Cons:** Migration touches ~10 list pages. Some filter combos make URLs long.
**Verdict:** **Migrate** — high UX value, low bundle cost. Ranks 1st in cost/benefit for users.

### 5. Tables — custom `DataTable` (`src/components/shared/DataTable/*`)

**Today:** In-house DataTable with sort/density/pagination, 600 lines split across modules.
**Library:** `@tanstack/react-table` (14 KB gzip; same family as `@tanstack/react-query` already used).
**Pros:** Column resize, virtualization, multi-sort, column filtering, faceted filters all built-in. Matches Tanstack ecosystem we already invested in.
**Cons:** Significant refactor (every page consuming `DataTable` would need adapting). Our current implementation works.
**Verdict:** **Defer** — only worth it once we need column resize, virtualization, or row selection. Don't migrate just for the sake of it.

---

## Medium value (defensible either way)

### 6. HTML escape — `src/lib/utils/htmlEscape.ts` (12 lines)

**Library:** `escape-html` (1 KB).
**Pros:** Audited, identical API.
**Cons:** Our 5-replace function is exactly what `escape-html` does internally. Adding a dep for 12 lines is overhead.
**Verdict:** **Keep** in-house.

### 7. Debounce — `useDebounce` (12 lines)

**Library:** `use-debounce` or `usehooks-ts`.
**Pros:** Battery of related hooks (`useDebouncedCallback`, throttle).
**Cons:** Our hook is a textbook React snippet — zero maintenance burden.
**Verdict:** **Keep** unless we adopt `usehooks-ts` for several hooks at once.

### 8. Title case / slugify — `toTitleCase`, `sanitizeStorageKey`

**Library:** `lodash.startcase`, `slugify`.
**Pros:** Smaller mental load.
**Cons:** Our implementations encode **business rules** (Mexican corporate suffixes "S.A. de C.V.", `LUGARES_ACENTUADOS` whitelist, RFC/CFDI/IVA acronyms). Lodash would lose those.
**Verdict:** **Keep** — these are intentionally Mexico-specific.

### 9. Currency / number formatting — `formatCurrency`, `formatCurrencyCompact`

**Library:** `dinero.js`, `currency.js`.
**Pros:** Safer arithmetic on money (avoids float rounding bugs).
**Cons:** We already use `Intl.NumberFormat` which is the standard; the libs above add value for **arithmetic**, not formatting. Our financial math is already centralized in `financialUtils.ts`.
**Verdict:** **Keep** formatting. **Consider** `dinero.js` if we ever hit floating-point bugs in `convertirAUSD`/IVA calculations (haven't yet).

---

## Low value (do not migrate)


| Area                                                               | Reason to keep                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `getErrorMessage` (5 lines)                                        | Trivial, no library beats this                                                                                                         |
| `useListPageState` business logic                                  | Already minimal; only the URL-state piece (#4) is worth changing                                                                       |
| `financialUtils` (IVA/conversion)                                  | Encodes Mexico business rules + project-specific override hooks (`useTasaIVA`)                                                         |
| Embarque/cotización mappers + Zod schemas                          | Domain code. Already using `zod` + `@hookform/resolvers` correctly                                                                     |
| `parsers/dashboard.ts`                                             | Specific to our Supabase RPC shapes                                                                                                    |
| `correctSpanishPlace` + acentuated places dict                     | Mexican-locale specific; no library covers this                                                                                        |
| Custom chunk-load recovery (`mem://technical/chunk-load-recovery`) | Could use `react-error-boundary` (~3 KB) for cleanliness, but current impl works and is referenced in memory as an established pattern |


---

## Suggested implementation order (if you want to act)

1. `**nuqs` for URL state** — biggest UX bang, smallest risk, ~½ day
2. `**libphonenumber-js/min` for phones** — correctness fix, ~1 hour
3. `**@react-pdf/renderer` or edge-function PDFs** — biggest user-visible upgrade but biggest effort, ~2 days
4. (Optional, later) `**@tanstack/react-table**` when we actually need column resize/virtualization
5. (Optional, later) `**papaparse` + `xlsx**` when we add Excel export

Bundle impact of items 1-2: **+~40 KB gzip**. Items 3-5 each add 100-350 KB and should be evaluated individually against feature value.

---

## Questions before implementing

- Do you want me to start with #1 (URL filters via `nuqs`) since it's the cheapest and most visible? Yes
- For PDFs — should they continue printing via the browser, or do you need real `.pdf` files (so they can be emailed/stored)? Continue printing via browser for now.
- Is Excel export on the near-term roadmap? If yes I'd jump straight to a library that covers CSV + XLSX in one shot. We will start using Google Sheets for almost all work.