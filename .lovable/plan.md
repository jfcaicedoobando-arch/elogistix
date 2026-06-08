## Objetivo
Limpiar el área de filtros de `/embarques`. Hoy hay 6 controles inline (Modo, Estado, Cliente, Operador, Desde, Hasta) que en viewports medianos se amontonan. La nueva versión expone solo lo esencial y mueve el resto a un panel lateral, con chips visibles para los filtros activos.

## Diseño propuesto

### Fila 1 — Barra compacta (desktop y móvil)
```text
[ 🔍 Buscar expediente, cliente o mercancía…    ] [ Estado ▾ ] [ Cliente ▾ ] [ ⚙ Filtros (N) ]
```
- **Search** ocupa el espacio flexible.
- **Estado** y **Cliente** quedan inline (son los más usados).
- **Filtros (N)** abre un `Sheet` lateral con: Modo, Operador, ETD desde, ETA hasta. El badge `(N)` muestra cuántos secundarios están activos.
- En móvil (<md) sigue siendo: search + botón "Filtros (N)" que abre el sheet con TODOS los filtros (incluidos Estado/Cliente).

### Fila 2 — Chips de filtros activos
Debajo de la barra, solo si hay al menos un filtro distinto del search:
```text
Activos: [Estado: En Tránsito ×] [Cliente: ACME ×] [Modo: Marítimo ×] [ETD ≥ 01/05/2026 ×]   Limpiar todo
```
- Cada chip muestra etiqueta + valor + X para quitarlo individualmente.
- "Limpiar todo" a la derecha resetea todos los filtros (no el search).

## Archivos a tocar

- **`src/features/embarques/components/EmbarquesFiltrosCampos.tsx`**
  - Layout inline: dejar solo `Search + Estado + Cliente`. Eliminar Modo, Operador, FechaDesde, FechaHasta del modo inline.
  - Conservar el layout `stacked` (sheet) sin cambios; ahí siguen apareciendo todos.

- **`src/features/embarques/components/EmbarquesFiltros.tsx`**
  - Renderizar la nueva barra unificada (desktop y móvil) con `Sheet` siempre disponible para los secundarios.
  - En desktop, el `Sheet` solo muestra los 4 secundarios (Modo, Operador, ETD desde, ETA hasta). En móvil sigue mostrando todos.
  - Insertar el render de `<EmbarquesFiltrosChips />` debajo de la barra cuando `activeFilterCount > 0`.

- **`src/features/embarques/components/EmbarquesFiltrosChips.tsx`** *(nuevo, ~80 LOC)*
  - Componente presentacional. Recibe los valores + setters + lista de clientes (para resolver nombre desde id).
  - Renderiza un `Badge` con `X` por cada filtro activo y un botón "Limpiar todo".
  - Formatea fechas como DD/MM/YYYY (es-MX).

- **`src/features/embarques/components/embarquesFiltrosUtils.ts`**
  - Reutilizar `countActiveEmbarqueFilters`. Añadir helper opcional `getActiveFilterChips(...)` que devuelva un array `{ key, label, onRemove }` para el componente de chips (mantiene la lógica fuera del JSX).

- **`src/constants/appVersion.ts`** — bump.
- **`CHANGELOG.md`** — entrada nueva describiendo el rediseño.

## Detalles técnicos

- No se cambia el contrato de `useEmbarquesPageController` ni del padre `Embarques.tsx`: los mismos props bajan al componente de filtros.
- Los setters individuales del chip llaman a `onFilterXxxChange("todos")` o `onFechaXxxChange("")` según el caso.
- El `Sheet` mantiene los botones "Limpiar" y "Aplicar" actuales.
- Accesibilidad: cada chip incluye `aria-label="Quitar filtro <nombre>"` en su botón X.
- Se conserva el comportamiento responsive existente: la barra hace wrap si el viewport lo requiere.

## Fuera de alcance
- No se tocan columnas de la tabla, paginación, ni la lógica de fetch/filtrado.
- No se cambia el `PageHeader` ni las acciones de export/nuevo embarque.
- No se modifica el portal de cliente.
