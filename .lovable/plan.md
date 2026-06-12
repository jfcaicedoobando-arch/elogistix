# Plan: +100 tests y umbral global 30%

## Objetivo
Subir cobertura global de **29% → 30%** (lines/statements) agregando ~110 tests sobre servicios y hooks puros con 0% de cobertura actual, sin tocar lógica de producción.

## Alcance (10 archivos de test, ~11 tests c/u)

Servicios sin cobertura candidatos (lógica pura + Supabase mockeable):

1. `services/embarques/queries.test.ts` — listado, filtros, paginación server-side.
2. `services/embarques/mutations.test.ts` — crear/actualizar/eliminar embarque, validaciones.
3. `services/cotizacion/mutations.test.ts` — crear/duplicar/aprobar/rechazar cotización.
4. `services/cotizacion/conceptos.test.ts` — sync de conceptos (delete + reinsert).
5. `services/facturas/proyeccion/*.test.ts` — cálculos de proyección de cobranza.
6. `services/facturas/aplicacionPagos.test.ts` — aplicación de pagos con diferencia cambiaria.
7. `services/cliente/queries.test.ts` — listado, búsqueda, filtros por organización.
8. `services/cliente/mutations.test.ts` — alta/edición/baja lógica + validación RFC.
9. `services/tracking/timeline.test.ts` — generación automática de eventos timeline.
10. `services/costeo/tarifasMaritimas.test.ts` — ranking Top 3 y matriz CN→MX.

Cada suite cubre: happy path, error de Supabase, validación de entrada, edge cases (vacío/null), y al menos un caso de transición o cálculo.

## Reglas a seguir
- Reusar `src/services/__tests__/_supabaseChainMock.ts` (extender si falta `.in()`, `.gte()`, `.lte()`).
- Cero cambios en código de producción; sólo tests + config.
- Cada test ≤ 200 líneas; sin `any`; cleanup en `afterEach` global ya existente.

## Cambios de configuración
- `vitest.config.ts`: subir `lines` y `statements` de **29 → 30**.
- `src/constants/appVersion.ts`: bump a `12.93.0`.
- `CHANGELOG.md`: entrada `## [12.93.0] - 2026-06-12` con resumen (+110 tests, umbral 30%).

## Validación
- Correr suite completa local; confirmar que pasa el umbral 30% en `lines`/`statements`.
- Si alguna suite baja branches por debajo del umbral actual (65), agregar 1-2 casos de rama.

## Ejecución
Spawn de 3 subagentes en paralelo, cada uno encargado de 3-4 archivos de test, para reducir tiempo de elaboración.
