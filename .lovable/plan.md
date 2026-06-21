## Contexto

El CI del run subido falló por 3 cosas, todas introducidas en los cambios recientes (v13.89.1 + cierre administrativo):

1. **Lint (max-warnings 0)** — `EmbarqueDetalleHeaderActions` tiene complejidad ciclomática 22 (máx 16).
2. **Lint** — `useEmbarqueEstadoActions` tiene complejidad 18 (máx 16).
3. **Tests** — `architecture-baseline.test.ts` y `audit-report.test.ts` fallan porque `TabGarantias.tsx` quedó en 258 líneas (Power of 10: ≤200).

Edge Functions, typecheck y los 8 shards de tests pasan; solo se rompen estos 2 jobs.

## Cambios propuestos

### 1. `TabGarantias.tsx` → bajar a ≤200 líneas

Extraer piezas auxiliares manteniendo el comportamiento idéntico:

- **Nuevo** `src/features/embarques/components/garantias/VenceBadge.tsx` — el componente `VenceBadge` y helper `diffDias`.
- **Nuevo** `src/features/embarques/components/garantias/GarantiasKpiCards.tsx` — las 4 cards de KPI (Depósito total, Por recuperar, Contenedores, Días prom. recuperación) recibiendo props simples (`totalDeposito`, `totalPendiente`, `count`, `diasPromRecuperacion`).
- **Nuevo** `src/features/embarques/components/garantias/useGarantiasColumns.tsx` — hook que devuelve las `ColumnDef<Row>[]` y encapsula el estado `editing` + `handleSaveMonto`/`handleSaveReferencia`/`handleChangeEstado`.
- `TabGarantias.tsx` queda como contenedor (~120 líneas): query de datos, cálculo de totales (memo), render de `GarantiasKpiCards` + `Card` con `DataTable`.

### 2. `EmbarqueDetalleHeaderActions.tsx` → complejidad ≤16

Extraer la lógica del botón "Avanzar":

- **Nuevo** `src/features/embarques/components/header/AvanzarEstadoButton.tsx` — recibe `{siguienteEstado, estadoVisual, avanzandoEstado, bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist, onAvanzarEstado, onIrACierre}` y devuelve el botón con tooltip + AlertDialog. Esto saca 3 ramas (`bloqueadoPorDocs` / `cierreBloqueadoPorChecklist` / normal) del componente padre, bajando la complejidad bajo el límite.
- `EmbarqueDetalleHeaderActions` calcula `ocultarAvance`/`cierreBloqueadoPorChecklist` y delega: `{canEdit && siguienteEstado && !ocultarAvance ? <AvanzarEstadoButton .../> : <BotónEditar/>}`.

### 3. `useEmbarqueEstadoActions.ts` → complejidad ≤16

`handleAvanzarEstado` concentra 4 ramas (docs hard, docs soft, gate de cierre por rol, gate por checklist) más la rama de `bloqueoCierreMotivo` ternaria anidada.

- **Extraer** función pura `resolveCierreGate(cierreVisible, rolPuedeCerrar, validacionOk)` al mismo archivo (top-level) que devuelve `"rol" | "checklist" | null`. Reemplaza el ternario anidado.
- **Extraer** función pura `clasificarBloqueoAvance({docsBloqueantes, docsFaltantes, siguiente, bloqueoCierreMotivo})` → `"block_docs" | "warn_docs" | "gate_cierre" | "ok"`. `handleAvanzarEstado` queda como un `switch` de 4 casos, complejidad ~5.

### 4. Versión y changelog

- Bump `APP_VERSION` a `13.89.4`.
- `CHANGELOG.md`: entrada `## [13.89.4] - 2026-06-20` — "CI fix: complejidad ciclomática de header/hook de estado + split de `TabGarantias` para cumplir Power of 10 (≤200 líneas). Sin cambios funcionales."

## Validación

- Build/typecheck corre solo al guardar (el harness lo dispara).
- Tests críticos a verificar localmente tras el cambio: `architecture-baseline.test.ts`, `audit-report.test.ts`, y los tests existentes de `TabGarantias` / `useEmbarqueEstadoActions` si los hay.
- No hay cambios de RPC, RLS, permisos ni UX visible.

## Detalles técnicos

- Los nuevos archivos viven bajo subcarpetas (`garantias/`, `header/`) — patrón ya usado en `components/cierre/`.
- `useGarantiasColumns` mantiene `eslint-disable react-hooks/exhaustive-deps` actual.
- Funciones puras (`resolveCierreGate`, `clasificarBloqueoAvance`) son trivialmente testeables; añadiré 1 test unitario corto por cada una en `src/features/embarques/hooks/__tests__/useEmbarqueEstadoActions.helpers.test.ts`.
