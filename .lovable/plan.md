# Auditoría de Tests — Estado actual y plan de mejora

## TL;DR

- **421 archivos** de tests Vitest/RTL + **5 suites RLS SQL** + **12 edge functions con tests Deno** + **5 specs Playwright** + **1 canary PDF**.
- **Higiene base excelente**: 0 violaciones `.only/.skip/duplicate-title` (después del fix de `13.12.1`).
- **Gaps principales** (en orden de riesgo):
  1. **41% de módulos productivos sin test asociado** (199 de 482), concentrados en cálculos financieros y mutaciones.
  2. **Aserciones débiles de error** (`.rejects.toBeDefined()`) en ~12% de tests de servicios.
  3. **RLS sin cubrir** en tablas sensibles: `costeo_tarifas`, `costeo_rutas`, `auditoria_revisiones`, `proveedor_notas_credito`.
  4. **E2E no bloquea PRs** y no cubre cross-org security ni descarga real de PDF.
  5. **Sin canarios** de query timeout ni bundle size gate real.

---

## Hallazgos por capa

### A. Frontend (Vitest + RTL) — 421 tests

| Severidad | Hallazgo |
|---|---|
| HIGH | Aserciones débiles `expect(...).rejects.toBeDefined()` en `relacionados.test.ts:41`, `agentes.test.ts:67`, `tarifas.test.ts:106` y otros ~12% de tests de servicios. No garantizan el error correcto. |
| HIGH | **Solo 11 tests de componentes** y 1 smoke de rutas vs. 190 tests de features. Formularios complejos (embarques, auditoría) sin test de integración Hook↔UI. |
| MEDIUM | Mocks Supabase inconsistentes — `usuarios/__tests__/index.test.ts` y `services/csf/__tests__/index.test.ts` no usan `_supabaseChainMock` estándar. |
| MEDIUM | Archivos sobredimensionados: `DataTable.regression.test.tsx` (367), `useAuditoriaEjecutivo.test.tsx` (247), `DataTable.perf.test.tsx` (245), `DataTable.e2e.test.tsx` (245). |
| LOW | `waitFor` sin timeout explícito en `useAuthProfile.test.ts:40`, `useComisiones.test.tsx:10` — riesgo de flakiness en CI lento. |

### B. Cobertura — 199 módulos productivos sin test (41%)

**Top 10 CRITICAL/HIGH sin test:**

| Módulo | Tipo | Escenario clave faltante |
|---|---|---|
| `src/features/embarques/hooks/useCostosPreciosCalc.ts` | Cálculo financiero | Redondeos multi-moneda y margen real |
| `src/hooks/profit/useEstadoResultados.ts` | Cálculo financiero | Consolidación ingresos/egresos en MXN |
| `src/hooks/presupuesto/usePresupuestoVsReal.ts` | Cálculo financiero | Desviaciones por TC fluctuante |
| `src/features/embarques/hooks/mutations/useCreateEmbarque.ts` | Mutación | Fallo atómico de conceptos venta/costo |
| `src/features/facturacion/hooks/useFactura.ts` | Mutación | Sincronización cancelación SAT |
| `src/hooks/comisiones/useComisionesDevengadas.ts` | Cálculo | Prorrateo multi-ejecutivo |
| `src/features/cxp/services/cfdiStorage.ts` | Parseo | CFDI XML corrupto |
| `src/features/cotizacion/hooks/mutations/useCotizacionMutations.ts` | Mutación | Idempotencia doble envío |
| `src/lib/domain/proyeccionFacturacion/agrupar.ts` | Cálculo | Cortes fiscales fin de año |
| `src/features/crm/hooks/leads/bulk.ts` | Mutación | Errores parciales en inserción masiva |

**Flujos con cobertura insuficiente** (tienen tests pero faltan ramas críticas): CRM Pipeline (0 tests de transiciones), Comisiones (0 tests de recálculo por NC), Presupuesto vs Real (0), EERR/Profit (0 tests de IVA exento), Auth (3 tests, falta refresh token expirado).

### C. Backend / RLS / CI / E2E

| Capa | Estado | Gap clave |
|---|---|---|
| Edge functions | 12/12 con tests | Faltan ramas error específicas de Auth (JWT expirado vs inválido) |
| RLS SQL | 5 suites, ~40 tablas | **Sin cubrir**: `auditoria_revisiones`, `costeo_tarifas`, `costeo_rutas`, `proveedor_notas_credito` |
| CI workflows | Lint/Type/RLS bloquean PR | E2E corre sólo nightly/manual, **no bloquea PR**. Coverage gate es informacional. |
| E2E Playwright | 5 specs (login, embarque, factura, conciliación, portal) | Sin: nueva cotización end-to-end, descarga PDF real, impersonación, **cross-org security** |
| Canarios/Perf | Solo `pdfRenderLeak.test.tsx` | Sin canary de query timeout ni bundle size gate efectivo |

---

## Plan de mejora — 4 fases (12 entregables)

Cada fase es independiente y deja CI verde. Bump `APP_VERSION` y `CHANGELOG.md` por entregable.

### Fase 1 — Riesgo de fuga de datos (RLS + Security E2E) · 2 entregables

**1.1** `supabase/tests/rls/test_rls_tarifas_y_costeo.sql` — cubre `costeo_tarifas`, `costeo_rutas`, `proveedor_notas_credito`, `auditoria_revisiones`. Mismo patrón BEGIN/ROLLBACK + `pg_temp.as_user/assert`. Registrar en workflow `rls-tests.yml`.

**1.2** `e2e/specs/06-security-cross-org.spec.ts` — usuario Org A intenta GET `/embarques/:idDeOrgB`, `/facturas/:idDeOrgB`, `/cotizaciones/:idDeOrgB`. Espera 404/redirect. Marcar workflow `e2e.yml` como required en PRs que toquen `src/components/**` o `supabase/migrations/**`.

### Fase 2 — Robustez de aserciones · 3 entregables

**2.1** Lint custom en `scripts/lib/tests.ts`: nueva regla `weak-rejects-assertion` que detecta `.rejects.toBeDefined()` / `.rejects.toBeTruthy()` y lo registra en `audit-report.test.ts`. Allowlist inicial con los ~50 hits actuales para no romper baseline.

**2.2** Refactor de los **15 tests más críticos** de servicios (financiero, embarques, facturación) para usar `.rejects.toThrow(/mensaje/)` o `.rejects.toMatchObject({ code })`. Reducir allowlist.

**2.3** Normalizar mocks Supabase: migrar `usuarios/__tests__/index.test.ts` y `services/csf/__tests__/index.test.ts` a `createSupabaseChainMock`. Agregar regla `audit-tests` que detecte `vi.mock("@/integrations/supabase/client")` sin importar el helper estándar.

### Fase 3 — Cierre de gaps de cobertura financiera · 4 entregables

**3.1** Tests de cálculo puro (alto ROI, sin mocks): `useCostosPreciosCalc`, `useEstadoResultados`, `usePresupuestoVsReal`, `useComisionesDevengadas`, `agrupar.ts`. Aislar lógica pura si está acoplada al hook.

**3.2** Tests de mutaciones críticas con `createSupabaseChainMock`: `useCreateEmbarque` (rollback parcial), `useCotizacionMutations` (idempotencia), `useFacturaProveedorMutations` (duplicidad RFC+folio).

**3.3** Tests de flujos sin cobertura: CRM transiciones de etapa (`crm_oportunidades` domain), Comisiones recálculo por NC, EERR con IVA exento vs gravado.

**3.4** Refresh token / sesión expirada en `useAuthSession`.

### Fase 4 — Performance & guardrails · 3 entregables

**4.1** `src/test/canaries/queryTimeout.test.ts` — ejecuta las 5 queries más pesadas (lista embarques, EERR, cobranza, tesorería flujo, dashboard ejecutivo) contra mocks deterministas y falla si tardan >250ms en CPU CI.

**4.2** Bundle size gate real: `scripts/check-bundle-size.sh` con umbral duro por chunk (lazy chunks <250KB gzip, vendor <500KB). Integrar a `lint, typecheck, unused code & build` job para fallar PR.

**4.3** Refactor de los 4 archivos test sobredimensionados (`DataTable.*`, `useAuditoriaEjecutivo`) — partir por aspecto (sorting, pagination, perf) cada uno <200 líneas para alinear con regla Power of 10.

---

## Detalles técnicos

- **Auditor existente**: `scripts/lib/tests.ts` + `src/__tests__/audit-report.test.ts` ya enforzan `duplicate-title`, `.only`, `.skip`. Las nuevas reglas (`weak-rejects-assertion`, `supabase-mock-helper`) siguen el mismo contrato (`{file, line, rule, detail}`) y respetan baseline/allowlist como el patrón actual.
- **RLS suite nueva**: replicar header de `test_rls_operaciones.sql` con `BEGIN` y `ROLLBACK`. Sembrar 2 orgs + admin + cliente portal. Registrar archivo en `.github/workflows/rls-tests.yml` (paso adicional `psql -f`).
- **E2E cross-org**: usar `e2e/fixtures/auth.ts` para sesionar como Org A y atacar IDs sembrados en Org B en `globalSetup`.
- **Allowlist temporal** para regla `weak-rejects-assertion`: documentar en mismo formato que `PAGES_COMPONENTS_BASELINE` en `audit-report.test.ts`.
- **Cada PR**: bump `APP_VERSION` patch + entrada en `CHANGELOG.md` (regla `mem://instructions/changelog-updates`).

## Fuera de alcance

- Cobertura 100% de componentes UI puros (alto costo, bajo ROI).
- Linter SQL (`sqlfluff`) — pospuesto, RLS tests ya garantizan integridad funcional.
- Tests de integración con DB real desde edge functions (requiere infra adicional).

## Recomendación de orden

Ejecutar **Fase 1 primero** (2 entregables, ~1 sesión) — mitiga el riesgo #1 del negocio (fuga de tarifas/datos cross-org). Luego Fase 2 (eleva la señal de la suite existente) antes de Fase 3 (escala cobertura). Fase 4 como guardrail continuo al final.
