# Internal PDF design system

## Visual contract

The 15 React-PDF documents share the app's light palette (`src/index.css`), Inter family (`tailwind.config.ts`), soft cards, subtle borders and navy hierarchy. Internal PDF exports use bundled OFL-licensed font assets, never a remote font CDN. The complete OFL is also copied to the production public assets. Regular body text is 9–10 pt; table amounts use 8 pt. Letter portrait is used for commercial documents and concise reports; wide operational tables use Letter landscape.

- `BrandHeader` and `BrandIdentity`: legal issuer information and optional existing issuer logo. A supplied commercial organization name stays distinct from the legal issuer. Missing configuration is neutral; no RFC, address or substitute tenant logo is invented.
- `ReportHeader`: compact identity plus shared scope/context panel for reports that previously had a local title block. Existing cutoffs, filters, methodologies and provisional-report warnings remain visible.
- `DataTable`: optional whole-word wrapping for commercial descriptions and identifiers, with invisible layout break opportunities for over-wide tokens (no added visible hyphens), soft headers, alternating rows, fixed numeric widths, repeated column headings and indivisible ordinary rows. No change to row renderers' arithmetic or currency formatting.
- `ReportSummary` and `TotalesBox`: aligned amounts with neutral colors. Explicit state text and existing overdue warnings can receive a supporting color; signs alone do not determine a color.
- Commercial continuation pages repeat document type and folio in the reserved upper margin, without changing their stored text.
- The customer statement uses the same type size with compact row padding and a wider folio column; its 45-row fixture keeps all rows and aging on three pages.
- `Footer`: issuer/commercial name where supplied, generation date and page count on every page. Long names are bounded in the footer and remain fully visible in the header.
- `NotasSection`: shared flowing notes layout; visibility still uses the existing `notasParaCliente` function exactly once.

## Scope

Quotation, informational tariff, individual and consolidated proforma, customer/supplier/bank statements, payment ledger, treasury log and summary, customer profitability, combined CxC/CxP aging, income statement, budget versus actual, and executive dashboard.

Facturapi-generated fiscal PDFs, fiscal payloads, data loaders, tenant guards and download authorization are outside this change. Optional logo presentation does not change the emitter loader or initiate a new data lookup.

## Validation

Run `bun run test:pdf` for the real React-PDF lane, including 15 synthetic document variants and empty/long/multi-page cases. `src/pdf` unit tests cover identity absence, financial labels, existing tax calculations and styles. Real-render fixtures include MXN/USD/EUR, million-sized amounts, net balances, filters, long notes, accented Latin and Greek text. Inter also carries Cyrillic; it is not a universal CJK or emoji font.

Inspect generated files in `reports/pdf-smoke` using MuPDF or PDFium as well as Poppler before attributing a rendering artifact to the PDF. Check every page for clipped figures, isolated headings, missing last rows and footer numbering. The synthetic fixtures do not access an ERP or contain real company information.
