## Objetivo
Endurecer la cadena `VirtualDataTable → useVirtualTableState → VirtualRowsContainer` para garantizar consistencia de filas visibles bajo scroll rápido + cambios de `data` (filtros), sin mutar ningún estado externo. Documentar el contrato de inmutabilidad.

## Diagnóstico
- `VirtualDataTable.tsx` ya es un ensamblador delgado: NO toca estado de filtros (los filtros se aplican aguas arriba y el componente recibe `data` ya filtrada). El riesgo real está en la condición de carrera entre `virtualizer.getVirtualItems()` (calculado con el `count` anterior) y un re-render donde `rows.length` se redujo: `rows[vi.index]` puede ser `undefined` → React crash (`Cannot read properties of undefined (reading 'id')` en `VirtualRowsContainer`).
- `useVirtualizer` no recibe `getItemKey`; cuando `rows` reordena (cambio de sort/filtro), las keys absolutas dependen de `rows[vi.index].id`, y si el `vi.index` queda fuera de rango se cae.
- No hay JSDoc explícito que prohíba mutar `data`/filtros desde callbacks de scroll.

## Cambios

### 1. `src/components/shared/VirtualRowsContainer.tsx`
- Memoizar la lista de items renderizables con `useMemo`:
  - Filtrar `virtualItems` quedándose sólo con los que tienen `rows[vi.index]` definido.
  - Dependencias: `[virtualItems, rows]`.
- Si la lista queda vacía después del filtro, retornar el wrapper con `height: virtualizer.getTotalSize()` y `null` adentro (preserva el espacio del scroll, evita parpadeo).
- Comentario explicativo: el guard cubre la ventana entre `virtualizer.getVirtualItems()` (snapshot stale) y el render cuando `data` se redujo por un filtro aplicado durante un scroll rápido.

### 2. `src/components/shared/dataTable/useVirtualTableState.ts`
- Añadir `getItemKey` estable al `useVirtualizer`:
  ```ts
  getItemKey: useCallback((index: number) => rows[index]?.id ?? index, [rows])
  ```
  Esto hace que la identidad del virtual item sobreviva a reordenamientos (sort cliente) y que el virtualizer no recicle alturas de filas equivocadas durante el scroll rápido.
- Mantener el resto idéntico (no cambia el shape público).

### 3. `src/components/shared/VirtualDataTable.tsx`
- Ampliar el JSDoc del módulo con dos garantías explícitas:
  1. `data` DEBE venir ya filtrada e inmutable — el componente nunca dispara mutaciones de filtros desde callbacks de scroll.
  2. Bajo scroll rápido + cambio simultáneo de `data`, el contenedor filtra defensivamente los índices fuera de rango para no romper el árbol.
- Sin cambios de comportamiento ni de props.

### 4. Test nuevo — `src/components/shared/__tests__/VirtualRowsContainer.test.tsx`
- Render con `virtualItems` que contiene índices fuera de rango (simulando race) y verificar:
  - No lanza.
  - Renderiza solo las filas existentes.
- Mockear `Virtualizer` mínimo (`getTotalSize`, `measureElement`).

### 5. Versionado
- `src/constants/appVersion.ts` → `12.61.7`.
- `CHANGELOG.md`: entrada `## [12.61.7] - 2026-06-08`.

## Notas técnicas
- Sin cambios al estado de filtros ni al hook `useListPageState` (URL-synced con nuqs sigue siendo la única fuente).
- `getItemKey` reduce el churn de medición/identidad cuando cambia el orden/filtrado.
- El guard `rows[vi.index]` previene crashes intermitentes reportados al filtrar mientras se hace scroll inercial.
