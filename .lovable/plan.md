# Auditoría de cobertura Vitest

## Estado actual

- **51 archivos de test** sobre ~730 fuentes (~7%).
- **Bien cubierto:** `lib/domain`, `lib/financial`, `lib/mappers`, `lib/parsers`, `lib/csv`, `lib/audit`, `lib/formatters`, `lib/ui`, `lib/validation`, `lib/storage`, `lib/supabase`, `lib/jsoncargo`, auditoría (hooks), DataTable, permisos, changelog, 3 hooks crm puros recién añadidos.
- **Gaps reales (lógica pura sin tests):**

### `src/lib` sin cobertura
- `lib/domain/auditoriaCsv.ts` — generación CSV (alto riesgo de regresión).
- `lib/domain/auth.ts` — snapshot/rol.
- `lib/domain/configuracion.ts` — defaults y merges.
- `lib/domain/embarqueWizardCostos.ts` — cálculos de costos del wizard.
- `lib/domain/embarqueWizardDocumentos.ts` — validación checklist 11 docs.
- `lib/domain/errorCatalog.ts` — mapeo de errores.
- `lib/domain/validationFormat.ts` — formateo RFC/CURP/email.
- `lib/financial/costosUSD.ts` — conversiones FX (crítico, ya tuvimos bugs aquí).
- `lib/io/csv.ts`, `lib/io/zipDownload.ts`.
- `lib/jsoncargo/containerPrefixes.ts`, `lib/jsoncargo/externalTracking.ts`.
- `lib/mappers/cotizacion.ts`, `lib/mappers/cotizacionForm.ts`, `lib/mappers/embarqueCotizacion.ts` (sólo `embarque` y `cotizacionPaso1` están cubiertos).
- `lib/utils/htmlEscape.ts` — XSS surface, ¡crítico!
- `lib/idempotency.ts` — sólo integration test, falta unit.

### `src/services` sin cobertura
- `services/embarque/columns.ts` (puro), `services/embarque/contenedor.ts`, `services/embarque/eventos.ts`.
- `services/facturas/huecoFacturacion.ts` — lógica de hueco fiscal.
- `services/cotizacion/costos.ts` — cálculos.
- `services/admin/exportOrg.ts`, `services/admin/papelera.ts`.

### `src/hooks` sin cobertura (lógica derivable a puros)
- `hooks/embarque/useEmbarqueFinancials.ts` — KPIs financieros.
- `hooks/embarque/useEmbarquesFilters.ts` — lógica de filtros.
- `hooks/facturacion/useTabProyeccionController.ts` — proyección facturación.
- `hooks/facturacion/useHuecoFacturacion.ts`.
- `hooks/cotizacion/useCotizacionPL.ts` — P&L.
- `hooks/cotizacion/useCotizacionConversions.ts`.
- `hooks/operaciones/useDesempenoChartData.ts` — derivaciones para gráficas.
- `hooks/portal/usePortalDashboardKpis.ts`.
- `hooks/shared/useSidebarAlerts.ts` — cálculo demurrage.
- `hooks/shared/useDebounce.ts` — trivial pero útil.
- `hooks/admin/useAlertasSistema.ts`.
- `hooks/crm/useCrmDashboard.ts`, `hooks/crm/useAutomatizacionesEtapa.ts`.

## Priorización (ROI vs. esfuerzo)

**P0 — Crítico** (lógica financiera/seguridad, bugs ya documentados):
1. `lib/financial/costosUSD.ts`
2. `lib/utils/htmlEscape.ts`
3. `lib/domain/embarqueWizardCostos.ts`
4. `lib/domain/embarqueWizardDocumentos.ts`
5. `services/facturas/huecoFacturacion.ts` (extraer puro si hace falta)
6. `hooks/embarque/useEmbarqueFinancials.ts` (extraer cálculos a `lib/financial/embarqueKpis.ts`)

**P1 — Alto valor** (lógica de derivación visible al usuario):
7. `lib/domain/auditoriaCsv.ts`
8. `lib/domain/validationFormat.ts` (RFC/CURP/email)
9. `lib/mappers/cotizacion.ts` + `cotizacionForm.ts`
10. `hooks/cotizacion/useCotizacionPL.ts` (extraer puros)
11. `hooks/operaciones/useDesempenoChartData.ts` (extraer puros)
12. `hooks/shared/useSidebarAlerts.ts` (extraer puro de demurrage)

**P2 — Útil pero menor riesgo:**
13. `lib/domain/errorCatalog.ts`, `lib/domain/configuracion.ts`, `lib/domain/auth.ts`
14. `lib/io/csv.ts`, `lib/io/zipDownload.ts`
15. `lib/jsoncargo/containerPrefixes.ts`
16. `services/embarque/columns.ts`
17. `hooks/shared/useDebounce.ts`, `hooks/embarque/useEmbarquesFilters.ts`

## Ejecución en paralelo

Vitest corre cada archivo en su propio worker — **no hay límite práctico de paralelismo entre archivos**. Lo que importa es no compartir estado mutable entre tests (todos son puros aquí).

Para **generar** los archivos en una sola pasada: puedo escribir **hasta ~10 archivos en paralelo** por llamada de herramientas (límite práctico del agente). Propongo:

- **Tanda 1 (P0, 6 archivos):** `costosUSD`, `htmlEscape`, `embarqueWizardCostos`, `embarqueWizardDocumentos`, `huecoFacturacion` (con extracción), `embarqueKpis` (con extracción desde `useEmbarqueFinancials`).
- **Tanda 2 (P1, 6 archivos):** `auditoriaCsv`, `validationFormat`, `mappers/cotizacion`, `cotizacionPL` (extracción), `desempenoChart` (extracción), `sidebarAlerts` (extracción demurrage).
- **Tanda 3 (P2, opcional, ~8 archivos):** resto.

Cada tanda termina con `bunx vitest run` para validar verde, bump de `APP_VERSION`, entrada en `changelogData.ts` y chunk `v8/0.ts`.

## Lo que NO entra
- E2E Playwright (ya existe en `/e2e/`, fuera de Vitest).
- Tests de UI/snapshot de componentes grandes (frágiles).
- Refactors no necesarios para testear.

## Pregunta para ti

¿Voy con **Tanda 1 (P0)** solamente, **P0 + P1**, o **las 3 tandas**? Mi recomendación: **P0 + P1 (12 tests nuevos)** en este loop — máximo ROI, sin tocar features.
