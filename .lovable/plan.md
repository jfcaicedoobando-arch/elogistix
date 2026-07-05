# Fase 4 y 5 — Migrar las tablas restantes al `DataTable`

Auditamos con subagente el resto de la app (excluyendo lo ya migrado en `13.172.16`). Encontramos **8 tablas de datos** que aún usan el primitivo `<Table>` de shadcn y **9 casos legítimos** que no deben migrarse (forms editables inline y sub-tablas de display de pocas filas fijas).

Analogía: es como reemplazar las últimas máquinas de escribir en la oficina por computadoras del mismo modelo que ya usa todo el equipo. Los formularios en papel (form-tables) se quedan como están porque cumplen otra función.

## Fase 4 — Alta prioridad (listados principales)

Son listados largos, con acciones, que se benefician directamente del skeleton, sort y empty state estándar del `DataTable`. Bump `13.172.17`.

1. **`/agente/tarifas`** — `portal-agente/routes/AgenteTarifas.tsx`
   - Preservar: tabs de filtro por estado, kebab (crear/editar/duplicar), badge best-price.
2. **`/agente/embarques`** — `portal-agente/routes/AgenteEmbarques.tsx`
   - Solo lectura. Agregar sort por ETD/ETA con `sortByDate`.
3. **`/costeo/tarifas`** — `costeo/components/CosteoTarifasTable.tsx`
   - Preservar: botones inline de aprobar/rechazar (como `actionsColumn` custom), best-price badge, columnas responsive (`hidden lg:table-cell` para Flete/Recargos).
4. **`/costeo/rutas`** — `costeo/components/CosteoRutasTable.tsx`
   - Preservar: `onRowClick` navega a `/costeo/tarifas`, delete inline, `computeRutaEstado` como `statusColumn` (dominio `ruta_maritima` — validar en `statusRegistry`, agregar si falta).
5. **`/costeo/agentes`** — `costeo/components/CosteoAgentesTable.tsx`
   - Preservar: 3 acciones (editar / eliminar / invitar portal) como `actionsColumn`. Badge activo → `StatusBadge`.

## Fase 5 — Prioridad media (sub-tablas con lógica)

Bump `13.172.18`. Migran preservando comportamiento no trivial.

6. **`/agente/garantias`** — `portal-agente/routes/AgenteGarantias.tsx`
   - Tabla actúa como selector: `onRowClick` selecciona fila y abre panel lateral con `DemorasTarifaEditor`. Pasar `onRowClick` + resaltar `selectedRowId`.
7. **`/embarques/:id` tab Reconciliación** — `embarques/components/reconciliacion/ReconciliacionTresColumnas.tsx`
   - Preservar: Switch "solo varianza", colorización por clasificación con `cellClassName` en `columnDef`.
8. **`/embarques/:id` tab P&L Contenedor** — `embarques/components/TabPnlContenedor.tsx`
   - Migración simple: filas fijas por contenedor, columnas por moneda. Sin sort necesario.

## Fuera de alcance (confirmado)

No se tocan — son form-tables de captura o sub-tablas de display de pocas filas fijas:

- **Catálogos editables inline:** `CatalogoClavesSATCard` (+ `.parts.tsx`), y por analogía `TabPuertos`/`TabNavieras`/`TabTiposContenedor` si aplican.
- **Editor de tramos:** `DemorasTarifaEditor.tsx`.
- **Conceptos de factura/cotización (display):** `FacturaConceptosTable`, `PortalFacturaConceptosTable`, `TablaConceptosGenerico`.
- **Conceptos editables:** `TablaCostosDetalle`.
- **Dimensiones de mercancía en wizard:** `SeccionMercanciaMaritimaLCL`, `SeccionMercanciaAerea`, `DimensionesLCLTable`, `DimensionesAereasTable`.
- **Ya correcto:** `EmbarquesRelacionadosCard` (usa `DataTable` con `customRowRender`).

## Detalles técnicos

- Reutilizar `columnBuilders` (`statusColumn`, `moneyColumn`, `dateColumn`, `actionsColumn`), helpers de sort (`sortByString`, `sortByDate`), y `StatusBadge`.
- Antes de Fase 4, verificar/agregar dominios en `src/lib/status/statusRegistry.ts`: `ruta_maritima`, `tarifa_maritima` (Borrador/Vigente/Rechazada/Por vencer), `garantia_naviera`, `agente` (activo/inactivo).
- Cada tabla migrada: `skeletonRows={5}`, sticky en 1ª columna, responsive `hidden xl:table-cell` en columnas secundarias donde ya lo tenían.
- Verificación: `bun run test` + recorrido manual de cada ruta migrada, confirmando que las acciones y navegación funcionan igual.

## Changelog

- `13.172.17` — Fase 4 (5 listados principales).
- `13.172.18` — Fase 5 (3 sub-tablas con lógica interactiva).

Cada entrada listará los archivos migrados y las precauciones tomadas (acciones inline preservadas, `onRowClick` mantenido, columnas responsive respetadas).
