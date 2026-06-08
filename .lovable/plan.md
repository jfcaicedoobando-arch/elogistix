# Plan de Remediación — Tests 🔴 CRITICAL + 🟠 HIGH

Basado en `docs/audit-tests-2026-06-08.md` (93 hallazgos, 57 archivos).
Alcance: **8 CRITICAL + 30 HIGH = 38 hallazgos** distribuidos en 6 módulos.
Total estimado: **~6.5 días-dev** repartidos en 2 sprints.

## Resumen de impacto por módulo

| Módulo | Archivos | 🔴 | 🟠 | Esfuerzo | Riesgo si NO se arregla | Responsable sugerido |
|---|---:|---:|---:|---:|---|---|
| `features/auditoria/services` | 5 | 4 | 1 | 1.0 d | Servicios de auditoría con mocks rotos → regresiones silenciosas en RLS/multi-tenant | Backend / Auditoría |
| `pdf/documents` + `pdf/theme` + `pdf/render` | 14 | 1 | 13 | 2.0 d | Documentos PDF (cotización, proforma, EERR, rentabilidad) sin validar contenido → folios/totales pueden corromperse sin que el CI lo detecte | PDF / Reportes |
| `services/*` (barrels + organization + notificaciones) | 8 | 0 | 7 | 1.0 d | Mocks compartidos con estado mutable → tests verdes con orden distinto; barrels que sólo duplican typecheck | Backend / Services |
| `hooks` + `contexts` | 5 | 2 | 4 | 1.0 d | Hooks críticos (proformas, tracking, profit, admin org) sólo verifican `defined` → regresiones funcionales invisibles | Frontend / Hooks |
| `lib/financial` + `lib/parsers` + `lib/mappers` | 4 | 1 | 3 | 1.0 d | `aUSD` con `tcUSD=0 → Infinity` propaga a totales financieros; títulos duplicados; NaN no cubierto | Financiero |
| `supabase/functions/parse-csf` | 1 | 1 | 0 | 0.5 d | Validador de CSF replicado localmente → divergencia con producción | Edge Functions |
| **TOTAL** | **37** | **8** | **30** | **~6.5 d** | | |

---

## Sprint 1 — CRITICAL (1.5 días, P0)

### T1 · Eliminar copias locales de funciones bajo prueba (C-1) — 3 h · Backend
- `src/lib/__tests__/sentry.test.ts` → exportar e importar `isReactRefreshHmrError` / `isReactRefreshStackTrace`.
- `src/hooks/__tests__/useAdminOrgDetalle.test.ts` → importar hook real; eliminar `groupConfigByCategoria`/`MemberRow` redefinidos.
- `supabase/functions/parse-csf/validate_test.ts` → importar `validateFile` desde el módulo real.

### T2 · Reparar tests sin aserción real (C-2) — 1 h · QA
- `src/pdf/render/__tests__/descargarPdf.test.ts` → llamar a `descargarPdf` y validar el resultado (Blob/llamada a `saveAs`).
- `src/contexts/__tests__/BreadcrumbContext.test.tsx` → reemplazar `expect(true).toBe(true)` por aserción sobre `result.current.crumbs`.

### T3 · Migrar mocks ad-hoc de `auditoria/services` a `createSupabaseMock` (C-3) — 4 h · Backend
- `comentarios.test.ts`, `revisiones.test.ts`, `snapshots.test.ts`, `snooze.test.ts` → usar `src/test/utils/_supabaseChainMock.ts` (ver `mem://technical/testing-mock-patterns`).

### T4 · Cubrir edge case `aUSD(tcUSD=0)` (C-4) — 1 h · Financiero
- `src/lib/financial/__tests__/costosUSD.test.ts` → agregar test `aUSD(100, "MXN", 0, _)` esperando comportamiento controlado (throw / 0 / `null`) según política a definir con dominio.

---

## Sprint 2 — HIGH (5 días, P1)

### T5 · Eliminar/reemplazar 6 barrel-tests (H-1) — 2 h · Backend
- Borrar `index.test.ts` en `services/comisiones`, `cxp`, `presupuesto`, `profit`, `tesoreria` y `features/auditoria/services`.

### T6 · Reescribir 10 tests de Documents PDF (H-2) — 8 h · PDF
- `Cotizacion`, `ProformaConsolidada`, `Proforma` (eliminar `it` duplicado), `ProformaHeader`, `Rentabilidad`, `ReporteCartera`, `ReporteEERR`, `ReporteEjecutivo`, `ReportePresupuesto`, `ReporteTesoreria`.
- Patrón: `expect(screen.getByText("COT-001")).toBeInTheDocument()` para folio, cliente y totales clave.

### T7 · Validar valores en theme PDF (H-3) — 2 h · PDF
- `styles.test.ts`, `stylesContent.test.ts`, `stylesLayout.test.ts` → afirmar `fontSize`, `padding`, `backgroundColor` críticos.

### T8 · Reset de mocks en services con estado mutable (H-4) — 2 h · Backend
- `services/organization/__tests__/index.test.ts` y `services/notificaciones/__tests__/index.test.ts` → `beforeEach(vi.resetAllMocks)` + reescribir terminal dual (`range`+`then`) con `createSupabaseMock`.

### T9 · Consolidar triple `vi.mock` (H-5) — 0.5 h · Frontend
- `src/hooks/facturacion/__tests__/useTabProformasController.test.tsx` → fusionar los 3 `vi.mock("@/hooks/shared", …)` en uno solo con todos los exports.

### T10 · Convertir hooks "smoke-only" en tests funcionales (H-6) — 4 h · Frontend
- `useProformas.test.tsx`, `useTrackingLinks.test.tsx`, `useProfit.test.tsx` → ejercitar `mutate`/`refetch` con datos y validar estado resultante.

### T11 · Cerrar HIGH restantes (H-7) — 4 h · Mixto
- `embarqueWizardStepValidator.test.ts:42` → cambiar `typeof errors === "object"` por `expect(errors).toEqual({...})`.
- `useCotizacionHydration.test.tsx:29` → envolver en `waitFor`.
- Renombrar título `"retorna 0 con lista vacía"` triplicado en `costosUSD.test.ts` / `financialUtils.test.ts`.
- `dashboardSchemas.test.ts` → agregar caso Zod inválido para `arribosEsteMesSchema` y `cargaPorClienteSchema`.
- `lib/mappers/_helpers.test.ts` → cubrir `num("NaN")` y `num("Infinity")`.

---

## Entregables

1. PRs separados por módulo (6 PRs) para review focalizado.
2. CI verde en cada PR (`bun run audit:tests` + suite afectada).
3. Bump `APP_VERSION` y entrada en `CHANGELOG.md` por sprint.
4. Actualización de `docs/audit-tests-2026-06-08.md` marcando hallazgos resueltos.

## Métricas de éxito

- 🔴 CRITICAL: **8 → 0**.
- 🟠 HIGH: **30 → ≤5** (sólo los que requieran decisión de producto).
- Cobertura efectiva PDF: aserciones de contenido en 10/10 Documents.
- 0 tests con `expect(true).toBe(true)` o cuerpo vacío.

## Fuera de alcance

- MEDIUM (36) y LOW (19) → Sprint 3 posterior.
- Refactor de SUT (sólo se tocan tests y exports necesarios para importar lógica).
- Ejecución completa de la suite en CI (queda a cargo del pipeline normal).
