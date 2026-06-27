## Objetivo

Aplicar los hallazgos del reporte de auditoría de los 12 shards en 3 oleadas secuenciales, con paralelismo dentro de cada oleada vía subagentes, y bumpear la versión + actualizar `CHANGELOG.md` al final de cada oleada.

## Estrategia general

- **1 subagente por shard** dentro de cada oleada, en paralelo, pero esta vez **con permiso de edición** (no read-only): cada uno aplica sólo los fixes de la severidad de la oleada actual en sus archivos.
- **Sin correr tests** durante la aplicación (igual que la auditoría). La validación final se hace una sola vez al cierre de cada oleada con `tsgo` (typecheck) — los runs de vitest los dispara el CI.
- **Bump de versión PATCH** al final de cada oleada (3 bumps totales) + entrada en `CHANGELOG.md` describiendo qué patrones se corrigieron y en cuántos archivos.

## Oleada 1 — CRÍTICA + ALTA

Patrones a corregir (del reporte consolidado):

1. **`pdfLeak.test.tsx`**: envolver el loop de 200 renders en `try/finally` con `cleanup()` por iteración.
2. **`csf/__tests__/index.test.ts`**: reemplazar `global.fetch = vi.fn()` por `vi.stubGlobal("fetch", …)` + `afterEach(vi.unstubAllGlobals)`.
3. **`embarques/services/__tests__/mutations.test.ts` y `listado.test.ts`**: agregar `mock.rpcCalls.length = 0` y `mock.tableCalls.length = 0` en `beforeEach`.
4. **Leaks de globals (ALTA, transversal)**: en todos los tests del shard, reemplazar asignaciones directas a `global.fetch`, `global.navigator`, `global.URL`, `window.matchMedia`, etc. por `vi.stubGlobal(…)` + cleanup.
5. **`QueryClient` compartido (ALTA)**: mover instanciación de `QueryClient` fuera del cuerpo del wrapper a una factory por test, usando el helper `createWrapper` de `src/test/utils/queryWrapper.tsx`.
6. **Mock hygiene (ALTA)**: en mocks `vi.hoisted` a nivel de módulo, agregar `vi.clearAllMocks()` (o `mockReset` específico) en `beforeEach` cuando falte.

Cierre de oleada:
- Bump `APP_VERSION` (PATCH) en `src/constants/appVersion.ts`.
- Nueva entrada en `CHANGELOG.md` raíz: `## [X.Y.Z] - YYYY-MM-DD` + bullets resumiendo patrones corregidos y nº de archivos por shard.

## Oleada 2 — MEDIA

Patrones:

1. **Timers reales frágiles**: reemplazar `await new Promise(r => setTimeout(r, 5))` / 10ms por `await Promise.resolve()` (microtask flush) o `vi.runAllTimersAsync()` cuando ya hay fake timers activos.
2. **Mocks manuales de Supabase**: migrar a `createSupabaseMock()` de `@/services/__tests__/_supabaseChainMock` donde el patrón es estándar (cadena `from().select()…`).
3. **`act()` sin `await`**: convertir `act(() => userTrigger())` en `await act(async () => { … })` cuando el callback dispara updates async.

Cierre de oleada: bump PATCH + CHANGELOG.

## Oleada 3 — BAJA

Patrones:

1. **Asserts débiles**: `toBeDefined()` solo → `toMatchObject({...})` o `toEqual({...})` con campos clave.
2. **Cleanup duplicado**: remover `cleanup()` manual en `afterEach` donde el setup global ya lo hace (`src/test/setup.ts`).
3. **Títulos duplicados de tests** dentro del mismo `describe`: renombrar para distinguir el caso.
4. **Imports no usados** en archivos de test detectados por la auditoría.

Cierre de oleada: bump PATCH + CHANGELOG + opcionalmente nueva memoria `mem://technical/testing-globals-stubbing` documentando la regla `vi.stubGlobal` (si la oleada 1 deja patrón consolidado).

## Detalles técnicos

- **Modelo de subagentes**: `capable` (los fixes requieren entender contexto del test y no romper aserciones).
- **Reparto**: misma partición de 12 shards que la auditoría — cada subagente recibe inline la lista de archivos y los fixes específicos a aplicar de su reporte.
- **Restricción**: cada subagente sólo toca archivos de su shard y sólo aplica patrones de la severidad de la oleada actual. No bumpea versión (eso lo hago yo al cierre).
- **Validación**: tras cada oleada, corro `bunx tsgo --noEmit` para confirmar que no se rompió tipado. Los tests los corre el CI al hacer push.
- **Rollback**: si una oleada introduce regresiones, revertimos sólo esa oleada (commits separados por bump).

## Lo que NO incluye

- Cambios en `vitest.config.ts` ni en `src/test/setup.ts` (a menos que un fix lo requiera explícitamente — en ese caso te pregunto antes).
- Refactor estructural de tests (sólo fixes puntuales del reporte).
- Correr la suite completa local (lo hace CI).
