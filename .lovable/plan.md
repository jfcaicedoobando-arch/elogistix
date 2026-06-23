## Objetivo
Que la tabla de facturas de proveedor (`/cxp`) aparezca ordenada por **Folio interno descendente** (FP-000123 primero) al cargar la página, manteniendo la posibilidad de re-ordenar haciendo click en cualquier encabezado.

## Cambios

### 1. `src/components/shared/dataTable/useTableInstance.ts`
- Aceptar un nuevo prop opcional `initialSort?: { key: string; dir: "asc" | "desc" }`.
- Usarlo como valor inicial de `useState<SortingState>` cuando el modo es `client` (en server-sort no aplica: la fuente de verdad sigue siendo el page-state).

### 2. `src/components/shared/DataTable.tsx`
- Exponer la nueva prop `initialSort` en la interfaz pública de `DataTable` y pasarla a `useTableInstance`.
- Documentar en el JSDoc que sólo aplica a `sortMode="client"` (default).

### 3. `src/features/cxp/routes/Cxp.tsx`
- Pasar `initialSort={{ key: "folio_interno", dir: "desc" }}` al `<DataTable />` de facturas de proveedor.
- El encabezado "Folio" ya muestra la flecha de orden vía TanStack, así que el indicador visual queda automáticamente.

### 4. Changelog y versión
- Bump `APP_VERSION` (patch) en `src/constants/appVersion.ts`.
- Entrada nueva en `CHANGELOG.md` describiendo: "Tabla de facturas de proveedor (CXP) ahora carga ordenada por Folio interno descendente por defecto".

## Fuera de alcance
- No se toca la lógica de fetching ni el RPC; el orden es 100 % client-side sobre la página actual (igual que el resto de columnas de esa tabla).
- No se cambia el comportamiento de otras tablas que usan `DataTable`: la prop es opcional y retro-compatible.

## Resumen para no técnicos
Es como abrir un archivero y que el cajón ya venga con las facturas más recientes hasta arriba en lugar de un orden aleatorio. Sigues pudiendo reordenar haciendo click en cualquier columna; sólo cambia con qué orden aparece la primera vez.