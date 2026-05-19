# Cierre Fase 2 — Migración a ColumnDef nativo

Continuación del trabajo ya iniciado. Quedan 4 pasos para dejar la Fase 2 completa y el build verde.

## 1. Arreglar `Facturacion.tsx` (build roto)

Migrar `gastoColumns` al formato nativo `ColumnDef<Gasto>[]` siguiendo el mismo patrón ya aplicado a `facturaColumns` en el mismo archivo:

- `key` → `id`
- `header` string → `header`
- `sortValue` → `accessorFn` + `sortingFn` (usar helpers de `sortingFns.ts`: `sortByString` / `sortByNumber` / `sortByDate` según tipo)
- `render` → `cell: ({ row }) => ...`
- `width`, `align`, `sticky`, `className` → `meta`
- Eliminar import residual de `DataTableColumn` si quedó.

## 2. Ampliar regresión

En `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx` agregar casos:

- Render con `ColumnDef<T>[]` nativo (sin pasar por adapter).
- Orden cliente con `sortByString` validando colación es-MX (acentos, mayúsculas).
- Orden con valores `null`/`undefined` cayendo al final.
- `meta.sticky` / `meta.align` / `meta.width` aplicando clases correctas.

## 3. Documentar Fase 2

Crear `docs/migracion-tabla-fase2.md` con:

- Resumen del alcance ejecutado (13 archivos core).
- Tabla de equivalencias `DataTableColumn` ↔ `ColumnDef` (key/header/render/sortValue/width/align/sticky/className → id/header/cell/accessorFn+sortingFn/meta.*).
- Lista de archivos migrados.
- Lista de archivos pendientes diferidos al ticket (dashboard, configuración, admin, portal, auditoría, papelera, reportes, idempotencia) con prioridad P1–P3.
- Criterio de cierre del adapter: eliminar `columnAdapter.ts` y el tipo `DataTableColumn<T>` cuando se cierre el ticket pendiente.
- Patrón recomendado para nuevas tablas (usar `defineColumns<T>` + helpers de `sortingFns.ts`).

## 4. Versionado y changelog

- `src/constants/appVersion.ts` → `9.2.0` (minor; sin breaking change, adapter sigue activo).
- Nueva entrada al inicio de `src/pages/Changelog.tsx` (fecha de hoy, 19/05/2026) describiendo Fase 2: 13 tablas core migradas a `ColumnDef` nativo, helpers de sorting es-MX, doc de migración y plan de eliminación de adapter.
- Chunk del changelog v9 actualizado en `src/content/changelog/v9/chunks/` si aplica el patrón existente.

## Fuera de alcance

- No tocar RPCs, filtros server-side, paginación, virtualización.
- No eliminar todavía `columnAdapter.ts` ni `DataTableColumn<T>` (se cierran junto al ticket pendiente).
- No migrar archivos diferidos (dashboard/admin/configuración/portal/auditoría/papelera/reportes).

## Archivos afectados

Editar: `src/pages/facturacion/Facturacion.tsx`, `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx`, `src/constants/appVersion.ts`, `src/pages/Changelog.tsx`, (changelog chunk v9 si existe).

Crear: `docs/migracion-tabla-fase2.md`.
