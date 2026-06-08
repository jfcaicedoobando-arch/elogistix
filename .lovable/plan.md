# Sprint 4 — Cierre MEDIUM residuales + LOW

Cerrar los hallazgos que quedaron fuera del scope práctico del Sprint 3 (M-3 silenciamiento, M-4 cobertura, M-5 E2E/edge, y los LOW de servicios críticos y edge functions). Objetivo: dejar el `docs/audit-tests-2026-06-08.md` con 0 hallazgos pendientes y CI verde en las 16 shards.

## Objetivos por bloque

### Bloque A — M-3 residuales (4 archivos)
1. `services/tesoreria/__tests__/resumen.test.ts` — el test de error path documentaba un bug silencioso (`cuentas ?? []` traga `error`). **Acción:** ajustar `fetchResumenTesoreria` para hacer `if (error) throw error` en la consulta de `cuentas_bancarias` y actualizar el test a `rejects.toThrow("db error")`. Alternativa si se decide preservar el silencio: assertir `console.error`/`logger.error` con spy.
2. `services/tesoreria/__tests__/flujoProyectado.test.ts:29-31` — reemplazar `expect(res).toBeDefined()` por asserts concretos: `res.semanas.length > 0`, `res.total_salidas_mxn === 0`, y verificar que el error de `liquidaciones_comision` fue tragado sin contaminar `por_pagar_mxn`.
3. `features/embarques/hooks/__tests__/useEmbarqueEstadoActions.test.tsx` — convertir el "smoke" en test funcional: invocar `handleAvanzarEstado()` y verificar que se llama `mutateAsync` del mock con el id correcto y que `toast` se dispara en éxito/error.
4. `features/embarques/hooks/__tests__/useEmbarqueDocumentosActions.test.tsx` — invocar `handleDownload(docId)` y `handleUpload(file)` y verificar `getSignedUrl`/`uploadFile` con args esperados.

### Bloque B — M-4 cobertura faltante (5 archivos)
5. `lib/domain/__tests__/estadoResultados.test.ts` — agregar caso EUR: concepto en EUR con `tc_eur`, validar conversión a MXN/USD y que se acumula en `ventaMxnFromEur`/`costoMxnFromEur`.
6. `lib/parsers/__tests__/dashboardProfit.test.ts` — añadir casos: `numOr0("NaN")`, `numOr0("Infinity")`, `safeMargen(-100, -200)` (ambos negativos), `safeMargen(0, 0)`.
7. `lib/mappers/__tests__/cotizacionBuildPaso1.test.ts` vs `cotizacionPaso1.test.ts` — auditar overlap real; consolidar en un solo archivo o cubrir branches distintos (build vs parse). Eliminar duplicados verdaderos.
8. `contexts/auth/__tests__/useAuthProfile.test.ts` — añadir caso `supabase.from("profiles").select... → { data: null, error }`: verificar que el hook expone `error` y no asume `profile` truthy.
9. `contexts/auth/__tests__/useAuthSession.test.ts` — mismo patrón: error en `getSession()` debe propagarse a `error`/`loading=false`.

### Bloque C — M-5 E2E y edge functions tautológicos (4 archivos)
10. `e2e/specs/02-embarque.spec.ts:21-27` — reemplazar `if (await firstRow.isVisible())` por `expect(firstRow).toBeVisible({ timeout: 5000 })` cuando hay seed, o marcar `test.skip(!process.env.HAS_SEED, "requiere seed")`.
11. `e2e/specs/04-conciliacion.spec.ts:14-16` — separar locators y assertir el caso vacío explícitamente (`[data-empty=true]`) o el caso poblado (`tbody tr`), nunca ambos a la vez.
12. `supabase/functions/auditoria-weekly-digest/digest_test.ts:62-68` — sustituir `assertEquals(typeof x, "object")` por aserts de forma del payload generado (claves, rangos de fechas).
13. `supabase/functions/auditoria-snapshot-daily/snapshot_test.ts:29-51` — assertir las inserciones reales sobre el mock (tabla, columnas, conteo).

### Bloque D — LOW restantes (5 archivos)
14. `services/cxp/__tests__/pagosProveedor.test.ts:38-39` — extender `_supabaseChainMock` para capturar argumentos de `insert/update` y assertir payload (importe, fecha, factura_id).
15. `services/proforma/__tests__/facturar.test.ts:30-41` — extender mock igual que (14) y validar `fecha_vencimiento = fechaFacturacion + dias_credito` (2026-01-31 + 30 = 2026-03-02 UTC).
16. `e2e/fixtures/auth.ts:27-33` — implementar `storageState` reutilizable: hacer login una vez en `globalSetup`, guardar en `e2e/.auth/user.json`, configurar en `playwright.config.ts`.
17. `lib/query/__tests__/keys-shape.test.ts` — reemplazar `EXPECTED_DOMAINS` hardcoded por diff explícito: `expect(actualDomains).toEqual(expect.arrayContaining(EXPECTED))` + log de extras.
18. Edge functions HTTP 4xx/5xx — añadir 1 caso por handler en `snapshot_test.ts`, `digest_test.ts`, `tracking_test.ts`, `validate_test.ts`: petición sin auth → 401, payload inválido → 400, error interno simulado → 500.

## Riesgos

- **(1)** Cambiar `fetchResumenTesoreria` para lanzar puede romper la UI de `TesoreriaResumen.tsx` si asume `cuentas: []` ante error. Verificar el consumidor antes y, si aplica, capturar con `try/catch` en el hook.
- **(14-15)** Extender `_supabaseChainMock` toca ~30 tests existentes. Mantener compatibilidad agregando un opcional `tableCalls[i].args` sin modificar la forma actual.
- **(16)** `storageState` requiere que el seed de demo tenga un usuario estable; validar contra `e2e/fixtures/auth.ts` actual.
- **(10-11)** Si el seed E2E no existe, los nuevos asserts fallarán; usar `test.skip` condicional documentado en lugar de `if` que pasa siempre.

## Orden de ejecución

A → B → D-14/15 (requieren extender el helper) → C → D-16/17/18 → bump `APP_VERSION` (12.61.20) + `CHANGELOG.md` + cierre del audit doc.

## Criterio de salida (verde)

1. `bunx vitest run` → **0 fallos** (mantener ~1424+ tests; ~20-30 nuevos esperados).
2. `bun run scripts/audit-tests.ts` → 0 duplicados, 0 `.only/.skip` huérfanos, 0 tautológicos detectados.
3. `bun run scripts/audit-report.ts` → `HIGH=0, CRITICAL=0, MEDIUM=0, oversized=0`.
4. `deno test supabase/functions/**/*_test.ts` → todos verdes, incluidos los nuevos 4xx/5xx.
5. CI 16 shards verdes.
6. `docs/audit-tests-2026-06-08.md` actualizado: secciones MEDIUM y LOW marcadas ✅ con referencia a 12.61.20.
7. `CHANGELOG.md` con entrada `## [12.61.20]` describiendo bloques A/B/C/D.
