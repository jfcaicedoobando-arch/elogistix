## Objetivo

Agregar **100 tests unitarios** de lógica de negocio sobre servicios/mappers/utilidades que aún tienen cobertura 0% o baja. Todos los tests deben:
- Ejecutarse con `vitest` puro (sin red, sin DB).
- Usar `createSupabaseMock` (chain mock existente) para servicios I/O.
- Usar tests puros (sin mocks) para mappers/utils.
- Tener títulos únicos (para no romper shard 6/16 del audit-report).

## Distribución (10 archivos × ~10 tests = 100)

Voy a lanzar **subagentes en paralelo** (read-only exploración) para mapear la firma exacta de cada servicio antes de escribir, y luego escribiré los 10 archivos de tests en paralelo.

| # | Archivo de tests | Módulo bajo prueba | ~Tests |
|---|---|---|---|
| 1 | `src/features/crm/services/__tests__/leads/mutations.test.ts` | `createLead`, `updateLead`, `deleteLead` (CRM) | 10 |
| 2 | `src/features/crm/services/__tests__/oportunidades.test.ts` | `crearOportunidad`, `actualizarOportunidad`, transiciones de etapa | 10 |
| 3 | `src/features/crm/services/vincularCotizacion/__tests__/vincularOCrear.test.ts` | Casos A/B/C (oportunidad existente, lead sin op, crear ambos) | 10 |
| 4 | `src/features/embarques/services/__tests__/contenedores.test.ts` | `sincronizarContenedores` (insert/update/delete diff) | 10 |
| 5 | `src/features/embarques/services/__tests__/garantiasDemoras.test.ts` | Cálculo automático garantías (no facturable) + demoras (costo + venta) | 10 |
| 6 | `src/features/facturas/services/__tests__/pagos.test.ts` | Registrar pago, conciliar, propagación de saldos | 10 |
| 7 | `src/features/tesoreria/services/__tests__/sugerirCandidatos.test.ts` (extender) | Más casos de matching de movimientos bancarios | 10 |
| 8 | `src/features/cotizacion/services/__tests__/conversionUSD.test.ts` | Conversión MXN↔USD con tasas dinámicas + IVA dinámico | 10 |
| 9 | `src/lib/mappers/__tests__/facturaFromDb.test.ts` | Mapper facturas DB→dominio (estados, totales, fechas UTC) | 10 |
| 10 | `src/generators/__tests__/exportCsvExtended.test.ts` | Casos extra de `exportCsv` (escape, BOM, separadores, vacíos) | 10 |

## Convenciones obligatorias

- Títulos de test **prefijados con el módulo** (ej. `"leads.create: valida email"`) para garantizar unicidad global y no romper `audit-report.test.ts` shard 6/16.
- Mock de Supabase vía `@/services/__tests__/_supabaseChainMock` + `vi.hoisted`.
- Para fechas: `vi.useFakeTimers()` con fecha fija `2026-06-13T12:00:00Z`.
- Sin tocar código de producción; si un servicio resulta no testeable sin refactor, lo registro en `.lovable/plan.md` y lo sustituyo por otro candidato equivalente del mismo módulo.

## Metadata

- Bump `APP_VERSION`: `12.98.9` → `12.99.0` (100 tests = milestone menor).
- `CHANGELOG.md` raíz: entrada `## [12.99.0] - 2026-06-13` listando los 10 archivos y el total (~100 tests).

## Verificación

1. `bunx vitest run <los 10 archivos>` → 100/100 verdes.
2. `bun run test:coverage:shard -- --shard=6/16` → debe seguir verde (títulos únicos).
3. Si algún archivo falla por shape de Supabase autogenerado, ajuste con cast mínimo al tipo correcto (sin `any`).

## Fuera de alcance

- Tests de componentes React / hooks RHF (alto costo de mock).
- Tests E2E (van por Playwright).
- Refactors de código de producción.

¿Apruebas el plan para que ejecute los 10 archivos en paralelo con subagentes?
