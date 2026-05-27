# Backlog de auditoría — estado al 11.68.0

## Cerrados

- ✅ **D14** (11.63.0) — Guardrail `oversized > 200` en `architecture-baseline.test.ts`.
- ✅ **C10** (11.63.0) — Quick wins inline styles + política en `mem://principles/inline-styles`.
- ✅ **D16** (11.64.0) — 0 casts HIGH/CRITICAL productivos. Clasificador + guardrail.
- ✅ **D12** (11.65.0) — Split de `routes.tsx` en 4 grupos por guarda+layout (188→19 líneas).
- ✅ **P1.5** (11.66.0) — `src/lib/utils/` único con barrel.
- ✅ **P1.6** (11.66.0) — Ningún servicio supera 200 líneas.

## Pendientes

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| D13 | Vigilar archivos 180-200 líneas (preventivo, continuo) | XS | Nulo |
| P1.7* | Extender Zod a boundaries restantes (6 hotspots cubiertos en 11.66+11.67) | S | Bajo |
| Cx* | Bajar complejidad src/ a CC ≤ 12 (2/13 cubiertos en 11.68; 4 edge functions sin tocar) | M | Medio |

## P1.7 — Estado parcial

Cubiertos en 11.66.0:
- `lib/parsers/dashboard.ts` (peso 14) → `dashboardSchemas.ts`
- `lib/mappers/embarqueToDb.ts` (peso 12) → `embarquePayloadSchemas.ts`
- `services/embarque/queries/exportListado.ts` (peso 10) → `embarqueRowSchema.ts`

Cubiertos en 11.67.0:
- `components/admin/TabSeguridadGlobal.tsx` (peso 12) → `hooks/configuracion/configSchemas.ts`
- `services/embarque/documentos.ts` (peso 12) → `services/embarque/idempotencyClaimSchema.ts`
- `components/auditoria/HallazgosFiltros.tsx` (peso 10) → `components/auditoria/hallazgosFiltrosSchemas.ts`

Descartados:
- `lib/audit/diffFields.ts` (peso 12) — genericidad estructural, no boundary.

## Cx — Estado parcial

Cubiertos en 11.68.0:
- `lib/crm/nextBestActions.ts` — `computeNextBestActions` CC 20 → 3 (5 helpers extraídos).
- `lib/csv/leadsCsv.ts` — arrow de `mapLeadCsvRows` CC 18 → 4 (parsers + setters table).

Pendientes (todos CC 15 con umbral objetivo 12; orden libre):
- `components/cotizacion/conceptos/ConceptoRowUSD.tsx:22` (`ConceptoRowUSD`)
- `hooks/auditoria/useAsignarResponsableController.ts:49` (arrow async)
- `hooks/operaciones/useOperacionesData.ts:146` (arrow)
- `lib/crm/forecast.ts:111` (`computeReportesCRM`)
- `lib/csv/parseCsv.ts:44` (`parseCsv`)
- `lib/domain/bitacoraDescripcion.ts:108` (`describirEntrada`)
- `pages/admin/AdminDashboard.tsx:20` (`AdminDashboard`)
- `pages/crm/Oportunidades.tsx:81` (arrow)
- `pages/portal/PortalCotizacionDetalle.tsx:18` (`PortalCotizacionDetalle`)
- `services/bitacora/index.ts:14` (`fetchBitacora`)
- `services/embarque/queries/paginados.ts:53` (`fetchEmbarquesPaginados`)
- `services/proforma/facturar.ts:17` (`marcarProformaFacturada`)

Edge functions (no auditadas aquí — fase posterior): 4 con CC > 12.

Cuando el contador llegue a 0, bajar `complexity` en `eslint.config.js` de 15 a 12.

## Próximo paso

Continuar **Cx fase 2** sobre 2-3 ofensores de CC 15 (sugerencia: empezar por funciones puras de `lib/` antes que componentes UI o hooks de Supabase).
