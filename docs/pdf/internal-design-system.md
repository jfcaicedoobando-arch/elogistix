# Internal PDF design system

## Visual contract

The 15 React-PDF documents share the app's light palette (`src/index.css`), Inter family (`tailwind.config.ts`), soft cards, subtle borders and navy hierarchy. Internal PDF exports use bundled OFL-licensed font assets, never a remote font CDN. The complete OFL is also copied to the production public assets. Regular body text is 9–10 pt; table amounts use 8 pt. Letter portrait is used for commercial documents and concise reports; wide operational tables use Letter landscape.

- `BrandHeader` and `BrandIdentity`: legal issuer information and optional existing issuer logo. A supplied commercial organization name stays distinct from the legal issuer. Missing configuration is neutral; no RFC, address or substitute tenant logo is invented.
- `ReportHeader`: compact identity plus shared scope/context panel for reports that previously had a local title block. Existing cutoffs, filters, methodologies and provisional-report warnings remain visible.
- `DataTable`: optional whole-word wrapping for commercial descriptions and identifiers, with invisible layout break opportunities for over-wide tokens (no added visible hyphens), soft headers, alternating rows, fixed numeric widths, repeated column headings and indivisible ordinary rows. `afterLastRow` keeps a final summary with its last row instead of leaving totals alone on a page. No change to row renderers' arithmetic or currency formatting.
- `ReportSummary` and `TotalesBox`: aligned amounts with neutral colors. Explicit state text and existing overdue warnings can receive a supporting color; signs alone do not determine a color.
- Commercial continuation pages repeat document type and folio in the reserved upper margin, without changing their stored text.
- The customer statement uses the same type size with compact row padding and a wider folio column; its 45-row fixture keeps all rows and aging on three pages.
- `Footer`: issuer/commercial name where supplied, generation date and page count on every page. Long names are bounded in the footer and remain fully visible in the header.
- `NotasSection`: shared flowing notes layout; visibility still uses the existing `notasParaCliente` function exactly once.

## Scope

Quotation, informational tariff, individual and consolidated proforma, customer/supplier/bank statements, payment ledger, treasury log and summary, customer profitability, combined CxC/CxP aging, income statement, budget versus actual, and executive dashboard.

Facturapi-generated fiscal PDFs, fiscal payloads and the existing fiscal emitter loader remain separate. Optional logo presentation does not initiate a new data lookup.

## Commercial identity and residual layout fixes

Internal PDF exports resolve `organizations.nombre` separately from fiscal configuration. The PDF service requires the document organization, or verifies its provider/account/invoice ID, and checks the captured authentication scope before and after asynchronous work. It never replaces the legal issuer name or RFC with a commercial name. Reports with organization-scoped query data carry that organization into export; the cash summary, aging report and executive dashboard retain their existing identity behavior until the provenance of their underlying snapshots can be established safely.

Existing platform-wide report exports keep neutral identity when their explicit null organization matches an authenticated superadmin scope. Missing or empty document IDs never select that global behavior. Email preparation, signed upload and sending retain the original scope through session reads, rendering and retry backoff.

Short ground quotations and compact income statements keep their totals/summary on the first page without smaller type. Long quotations keep totals with the final concept. Supplier statements wrap full folios, shipment references and UUIDs within their columns. Totals labels omit a repeated currency because each amount already carries it.

## Validation

Run `bun run test:pdf` for the real React-PDF lane, including 15 synthetic document variants and empty/long/multi-page cases. `src/pdf` unit tests cover identity absence, financial labels, existing tax calculations and styles. Real-render fixtures include MXN/USD/EUR, million-sized amounts, net balances, filters, long notes, accented Latin and Greek text. Inter also carries Cyrillic; it is not a universal CJK or emoji font.

Inspect generated files in `reports/pdf-smoke` using MuPDF or PDFium as well as Poppler before attributing a rendering artifact to the PDF. Check every page for clipped figures, isolated headings, missing last rows and footer numbering. The synthetic fixtures do not access an ERP or contain real company information.

`internalResidual38.test.tsx` also checks Poppler word bounding boxes for complete financial identifiers: raw extraction can include text that is clipped visually. Its layout checks require Poppler, alongside the normal real-renderer lane.
