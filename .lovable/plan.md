## Problema

CI (shard 8) falla: `src/features/profit/domain/estadoResultados.ts` tiene 202 líneas y excede el baseline arquitectónico de 200. Es el archivo que toqué en la fase anterior de Profit (Lote C, para agregar la columna "Otros" y reforzar `normalizeKey`). Se pasó de 200 por 2 líneas.

## Plan

Refactor mínimo del mismo archivo — sin cambiar comportamiento, sin tocar tests:

1. **Consolidar los dos pivotes duplicados** (`pivotConceptosVenta` y `pivotConceptosCosto`, que difieren solo en el nombre del campo `descripcion` vs `concepto` y `total` vs `monto`) en una sola función genérica `pivotConceptos<T>` con dos getters (`getDesc`, `getMonto`). Reemplaza ~30 líneas de duplicación por ~18 líneas.

2. Sin cambios en `buildEstadoResultados`, tipos exportados, ni orden de columnas. Los tests existentes (`estadoResultados.test.ts` y `estadoResultados.extra.test.ts`) deben seguir verdes tal cual.

3. Bump `APP_VERSION` a `13.300.51` y agregar entrada breve al CHANGELOG.

## Verificación

- `wc -l src/features/profit/domain/estadoResultados.ts` ≤ 195.
- `bunx vitest run src/features/profit/domain src/__tests__/audit-report.test.ts` en verde.

## Riesgo

Ninguno funcional — es una refactorización pura de deduplicación con misma firma pública.
