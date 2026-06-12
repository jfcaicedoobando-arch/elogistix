# Auditoría de CI y Tests — Diagnóstico + Plan de Remediación

## Resumen ejecutivo

El proyecto tiene una base de testing **superior al promedio**: helper centralizado `_supabaseChainMock` con 62% adopción, 16 shards paralelos en CI, canario anti-leak de PDF activo, parsers XML con tests exhaustivos (incluida protección XXE) y RLS aislamiento ejecutable. Pero hay **gaps críticos** que ponen en riesgo CI y cobertura real.

---

## Diagnóstico (estado actual)

### CI/CD
- **Triggers:** push a `main` + cualquier PR (`ci.yml`).
- **Jobs paralelos:** `quality` (lint, typecheck, knip, higiene), `edge-functions` (Deno tests), `tests` (Vitest 16 shards) + `coverage` consolidado.
- **Post-deploy:** `post-deploy-smoke.yml` por cron, solo prueba `user-management`.
- **Métricas reportadas:** líneas 29.0%, funciones 46.8%, ramas 67.7%. Casts: 1256 (0 HIGH/CRITICAL).

### Tests frontend (Vitest)
- 297 archivos de test distribuidos; `services/` y `lib/` saturados, `pages/` y `routes/` en **0**.
- Adopción de `@/test/fixtures`: **0.6%** (solo 2 tests).
- 60 ocurrencias de `as any` concentradas en `pdfLeak.test.tsx` y hooks de rentabilidad.
- 2 tests con `it.skip` (Proforma).

### E2E + Edge functions
- 5 specs Playwright (login, embarque, factura, conciliación, portal) — **no corren en CI**, solo manual.
- Edge functions con tests Deno cubiertas, pero `cxc-recordatorios` y `process-email-queue` son tests de contrato (string matching) en lugar de funcionales.
- RLS SQL ejecutable solo cubre `clientes`, `embarques`, `app_logs`, `bitacora`, `notificaciones`.

---

## Gaps críticos identificados

| # | Gap | Severidad | Evidencia |
|---|-----|:--:|---|
| 1 | **Cobertura real (29%) < threshold (40%)** → CI roja o reports desactualizados | P0 | `vitest.config.ts` vs `reports/coverage-report.md` |
| 2 | **`features/costeo` con 0 tests** (módulo core financiero) | P0 | sin tests para `useCosteoTarifas`, `useNavieraCondiciones`, `useDemorasVenta`, `useProformas` |
| 3 | **RLS sin cobertura en `facturas`, `cuentas_por_cobrar`, `gastos_embarque`** | P0 | `supabase/tests/rls/` |
| 4 | **E2E no corre en CI**: regresiones de flujo end-to-end invisibles hasta deploy | P1 | `playwright.config.ts` sin job en `ci.yml` |
| 5 | **Post-deploy smoke solo prueba `user-management`** (no `exchange-rates`, no `tracking-public`) | P1 | `post-deploy-smoke.yml` |
| 6 | **Sin cache de Bun/Deno en CI** → +2-3 min/run innecesarios | P1 | `ci.yml` |
| 7 | **Adopción de fixtures 0.6%** → fragilidad ante cambios de schema | P2 | barrel `@/test/fixtures` |
| 8 | **Tests de contrato débiles** en `cxc-recordatorios` y `process-email-queue` | P2 | string matching en lugar de mock de SupabaseClient |
| 9 | **2 tests con `it.skip`** en Proforma sin justificación | P2 | `ProformaHeader.test.tsx`, `ProformaDocument.test.tsx` |
| 10 | **Sin tests de routes/RBAC** | P2 | `src/routes/` |

---

## Plan de remediación

### Fase 1 — Estabilizar CI (P0, ~1 sprint)

1. **Sincronizar thresholds con realidad**: bajar temporalmente `vitest.config.ts` a 29/45/55/65 para desbloquear CI, y subir gradualmente +3 puntos por sprint hasta 40/55/58/70.
2. **Tests para `features/costeo`** (núcleo financiero):
   - `useCosteoTarifas.test.ts`, `useNavieraCondiciones.test.ts`, `useDemorasVenta.test.ts`, `useTopTarifas.test.ts`.
   - Servicios: `agentes.ts`, `rutas.ts`, `topTarifas.ts`, `navieraCondiciones.ts`, `demorasVenta.ts`.
   - Target: ≥70% líneas en `features/costeo/`.
3. **RLS aislamiento financiero**: extender `test_rls_isolation.sql` con casos para `facturas`, `cuentas_por_cobrar`, `gastos_embarque`, `proformas`, `cotizaciones`.
4. **Cache de dependencias en CI**: `actions/cache` para `~/.bun/install/cache` y Deno cache.

### Fase 2 — Cerrar gaps de integración (P1, ~1 sprint)

5. **Job E2E en CI**: nuevo job `e2e` que corra Playwright (Chromium) en PRs hacia `main`, solo specs etiquetados `@smoke` para no inflar duración. Ejecutar suite completa en cron nocturno.
6. **Spec E2E nuevo: Costeo + Profit** — registrar gasto, venta, validar profit (núcleo financiero sin cobertura).
7. **Expandir post-deploy smoke**: añadir `exchange-rates` y `tracking-public` a `post-deploy-smoke.yml`. Hacer que `DEMO_USER_*` faltante **falle** en lugar de warning.
8. **Refactor tests de contrato → funcionales**: `cxc-recordatorios` y `process-email-queue` con mock real de `SupabaseClient`.

### Fase 3 — Reducir deuda técnica (P2, continuo)

9. **Migración a fixtures**: script de codemod para reemplazar objetos manuales por `make*()` del barrel. Target: 30% adopción/sprint.
10. **Resolver `it.skip` de Proforma**: investigar y arreglar o eliminar.
11. **Tests de routes/RBAC**: smoke tests por rol verificando rutas accesibles vs bloqueadas.
12. **Reducir `as any` en tests**: priorizar `pdfLeak.test.tsx` y hooks de `rentabilidad` (top ofensores).

---

## Entregables propuestos para el primer sprint (Fase 1)

- `src/features/costeo/**/__tests__/*.test.ts` — ~8 archivos nuevos
- `supabase/tests/rls/test_rls_financiero.sql` — nuevo
- `vitest.config.ts` — thresholds ajustados (29→32→35→…→40)
- `.github/workflows/ci.yml` — bloques `actions/cache` para Bun + Deno
- `CHANGELOG.md` + bump `APP_VERSION` (12.88.0)

## Métricas de éxito

- CI verde de forma sostenida durante 2 semanas.
- Cobertura global ≥35% (líneas) al final del primer sprint, 40% al cierre de Fase 1.
- `features/costeo` ≥70% líneas.
- RLS aislamiento financiero ejecutable en CI.
- Tiempo de CI reducido ≥30% con cache.

## Notas técnicas

- **Power of 10**: respetar componentes ≤200 líneas en helpers de test nuevos.
- **Sin `any`**: todos los tests nuevos deben usar fixtures tipadas del barrel.
- **Helper Supabase**: usar `_supabaseChainMock` para todos los nuevos services tests (no inline `vi.fn().mockReturnValue(chain)`).
- **Sin breaking changes** en CI: cambios incrementales, gradualmente subiendo gates.
