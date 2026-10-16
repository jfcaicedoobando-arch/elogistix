# Migración conservadora de TanStack Table 9 (PR303)

## Base y alcance

- Main estable: `2fadc3040682c5faeddffedb0efb732df6edf500` (incluye PR375).
- Head original PR303: `4e47a1643b22f636a50dad29888c92ba9a7d1979`.
- Checkout autor: `pr303-table9`; referencia separada: `table9-baseline`.
- Runtime conservado: Node 24.22.0 y Bun 1.4.0, fijados por setup-bun.
- Dependencias instaladas: react-table/table-core 9.2.8 y react-store/store
  0.11.2. El lock integrado sólo añade/cambia ese subgrafo respecto de main.

La integración conserva main y la historia del PR. No modifica RPC, SQL,
permisos, estado de negocio, navegación ni estilos. Los cambios de consumidores
son los tipos ligados a features, `sortingFn` → `sortFn` y `table.state.sorting`.

`useTableInstance` usa `useTable` nativo, con features estáticas para sorting,
visibilidad y selección. Registra sólo text/alphanumeric/datetime requeridos por
auto; el modelo core es automático. `manualSorting` conserva exactamente el orden
recibido en servidor y evita orden local en las tablas virtuales. La paginación y
los filtros siguen siendo externos; no se registra su procesamiento en TanStack.

Los tipos públicos de la aplicación (`ColumnDef<T, unknown>`, Row, Cell, Table,
SortingFn, TableOptions y VisibilityState) están ligados a esas features. Las filas
son objetos, conforme a v9. VisibilityState representa ColumnVisibilityState y la
selección usa el estado nativo de IDs con valor true. Los metadatos visuales se
vinculan por `columnMeta`, sin augmentación global ni importación legacy.

El checkbox compartido prioriza all antes de some; en v9 some también incluye
todas. Se conserva el modo selección por fila y se deshabilita explícitamente el
rango nuevo. IDs y selección fuera de la página externa sobreviven a reorder.
Se retira un `size: 40` sin consumidor en la columna de selección de Compras:
los renderers usan clases/meta, no getSize; no se añade una feature de resizing.

## Contratos y validación local

Baseline v8: 62/62 casos focalizados existentes. Tras la migración: 80/80 casos
en 14 archivos, más selección restaurada y VirtualRowsContainer en una ejecución
separada. Cobertura añadida en los archivos existentes:

- Orden servidor deliberadamente contradictorio con el sort controlado; orden DOM
  exacto antes/después del clic y de cambiar datos y sort por rerender.
- Orden cliente real asc/desc/none para texto, natural, número y Date con empates;
  texto y natural detectan la caída silenciosa a basic si falta el registro.
- Visibilidad de headers/celdas con hook real, storage, rerender, remount y meta.
- Selección cero/parcial/todas/ninguna, IDs exactos, ratón y teclado sin navegar ni
  doble toggle; páginas [a,b] → [c,d] → [b,a] conservan los IDs fuera de página.
- El control negativo, restaurando temporalmente some antes de all, falla con
  aria-checked=mixed cuando se esperaba true; la corrección se restaura después.

También pasan lint completo (y lint de los últimos cambios), typecheck de app y
cuatro fixtures, build y cálculo local equivalente de los budgets existentes.
El entry local pesa 222468 bytes gzip; no hay .map ni referencias de sourcemaps.
Los scripts Bash originales de budgets/sourcemaps se exigen además en Actions.

GUI local aislada: 16/16 visuales, 20/20 diálogos/tarjetas, 8/8 reportes,
12/12 foco CxP y 2/2 virtualización Chromium con 240 filas. Las ocho capturas
shell/dialog en HD/compacto y claro/oscuro son idénticas byte a byte respecto del
baseline v8, sin actualizaciones de snapshots ni tolerancias.

Los carriles existentes de Actions deben aprobar en el SHA final: suite unitaria
completa con unión exacta, lint, typecheck, build, budgets, sourcemaps y 44 casos UI
(20+8+4+12). Los cuatro de virtualización incluyen Chromium y Firefox. El Firefox
de este host Windows tiene una limitación de arranque SxS ya conocida; su resultado
válido se exige en Linux. Ninguna comprobación local equivale a GUI de producción.

## Comandos reproducibles

Desde el checkout, usando los runtimes fijados por el repositorio:

```sh
bun install --frozen-lockfile --ignore-scripts
bun install --lockfile-only --ignore-scripts
node node_modules/eslint/bin/eslint.js . --no-cache
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run src/components/shared/dataTable/__tests__ src/hooks/shared/__tests__/useColumnVisibility.test.tsx src/features/embarques/components/reconciliacion/__tests__/reconciliacionLoteP2.test.ts src/features/bandejas/routes/_sections/__tests__/carteraPueSelection.audit54.test.tsx src/features/facturacion/hooks/__tests__/useProformasListadoTable.test.tsx
node node_modules/vite/bin/vite.js build
bash scripts/check-bundle-size.sh
bash scripts/check-sourcemaps.sh
node node_modules/@playwright/test/cli.js test --config playwright.visual.config.ts
node node_modules/vite/bin/vite.js build --config e2e/visual/audit119-126/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/audit119-126/playwright.config.ts
node node_modules/vite/bin/vite.js build --config e2e/visual/audit136-137/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/audit136-137/playwright.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/cxp-filters/playwright.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/virtualization/playwright.config.ts
```

En Windows las pruebas locales usan dos forks, TEMP/TMP del workspace y el cache
Playwright explícito. Las fixtures sólo montan componentes/datos sintéticos; se
conservan sus guards, bloqueo de red y build fresco. No se utiliza navegador admin.
Hashes, imágenes y logs locales están inventariados en
`docs/evidence/table9-local.json`; el resultado final remoto se registra por SHA.

## Riesgo previo de valores ausentes

Los helpers decían null-last en ambas direcciones, pero TanStack ya invertía el
comparador en v8. `moneyColumn.normalizar` convierte ausentes/no finitos a Infinity;
Infinity−Infinity produce NaN. El mismo contrato integrado se ejecutó sobre v8 y
v9: finitos ascendentes seguidos de ausentes; descendentes con ausentes primero y
finito alto/bajo después. Esta migración conserva ese comportamiento y documenta
la limitación; no introduce una política financiera nueva ni convierte null a
undefined para aprovechar sortUndefined. Una corrección de esa política requiere
un cambio separado con criterio de producto y pruebas de ambos sentidos.

## Paso 6: mejoras posteriores medibles

Tras estabilidad, medir un listado sintético representativo (240 filas) antes de
elegir cambios: bytes gzip del entry/carril table, duración p50/p95 de ordenar y
alternar visibilidad, y commits/renders durante selección y scroll. Comparar con
el mismo runtime, browser, datos y límite de memoria, en al menos cinco repeticiones.

Sólo adoptar una mejora si reduce el indicador elegido de forma repetible, conserva
los contratos y no empeora el resto: por ejemplo, una suscripción estrecha mediante
table.Subscribe para un consumidor que el perfil identifique, o eliminar un
registro no usado tras demostrarlo. Fijar una meta concreta después de medir el
baseline y entregar cada mejora en un PR pequeño. No añadir atoms, worker,
paginación/filtros internos ni rehacer los renderers para esta demo sencilla.

Fuente de API: [guía oficial de migración](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)
y declaraciones/implementación instaladas de la release 9.2.8.
