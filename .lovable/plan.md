## Diagnóstico real (v12.81.3)

El fix anterior (rescue de pointer-events de Radix) era correcto pero **no era la causa raíz** del problema de sort en CXP. Verificado en preview con logs temporales:

1. Click en header `<th>` → onClick **sí** dispara.
2. `header.column.getCanSort()` → **true**.
3. `getToggleSortingHandler()` → función válida que se ejecuta.
4. Pero el siguiente render de `DataTableHeaderRow` mostraba `table.getState().sorting === []` → **el state nunca cambia**.

Causa raíz en `useTableInstance.ts`: para modo client se pasaba

```ts
state: undefined,
onSortingChange: undefined,
```

TanStack v8 implementa `setSorting` como `options.onSortingChange?.(updater)`. Si `onSortingChange` es `undefined`, **es un no-op silencioso**. No hay fallback a un setState interno cuando se omite — el caller siempre tiene que conectar `state.sorting` + `onSortingChange`.

## Fix

En `src/components/shared/dataTable/useTableInstance.ts`:

- Modo client: `useState<SortingState>([])` interno + pasar `state.sorting` y `onSortingChange: setInternalSorting` al `useReactTable`.
- Modo server: sigue igual, conectado a `controlledSort` + `handleSortingChange` (que delega en `onSortChange` del page-state).

Una sola fuente de verdad por modo, sin tocar columnas, callers ni `DataTable.tsx`.

## Verificación

`/cxp` → click en header "Total":
- Aparece flecha ↓ activa.
- Filas reordenan desc: MXN 70,180 → 34,320 → … → 1.12.

## Changelog / versión

- `APP_VERSION` → `12.81.3`.
- Entrada `[12.81.3]` en `CHANGELOG.md` con la explicación técnica.
