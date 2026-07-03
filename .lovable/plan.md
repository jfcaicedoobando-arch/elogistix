# Oleada 1 — Primitivas compartidas

Objetivo: crear las 9 primitivas base que consumirán las oleadas 2-5. En esta oleada **no** se migran páginas: sólo se crean/extienden primitivas + tests. El único cambio visible al usuario es que el padding de página deja de duplicarse en las páginas CRM que hoy lo aplican dos veces.

## Alcance

### 1. `PageContainer` (nuevo)
- `src/components/shared/PageContainer.tsx` — encapsula `mx-auto w-full max-w-screen-2xl p-4 sm:p-6` + `space-y-6` por defecto.
- `src/components/layout/Layout.tsx` línea 61: reemplaza el `<div>` por `<PageContainer>`.
- Nada más se migra en esta oleada; los CRM se limpiarán en la oleada 4 cuando eliminen su padding local.

### 2. `PageHeader` extendido
- Agregar props opcionales: `tabs`, `subHeader`, y consolidar `actions` con `gap-2`.
- Mantener API actual retrocompatible (`title`, `description`, `icon`, `actions`, `className`).
- No migrar consumidores; sólo publicar los nuevos slots.

### 3. `StatusBadge` + `statusRegistry`
- `src/lib/status/statusRegistry.ts` — mapa `domain → status → { label, variant, icon? }` para los 5 dominios: `factura`, `proforma`, `embarque`, `cotizacion`, `lead`.
- Se poblará copiando los valores exactos de los 4 helpers existentes (`getEstadoColor`, `BadgeCiclo`, `EmbarqueBadgeAdmin`, `renderEstadoVigencia`) para no cambiar UX.
- `src/components/shared/StatusBadge.tsx` — `<StatusBadge domain="factura" status={s} />` sobre `Badge` de shadcn.
- Los helpers viejos se **conservan** y se marcarán deprecated en oleada 2.

### 4. `LoadingState` y `ErrorState`
- `src/components/shared/states/LoadingState.tsx` — `Loader2` centrado + texto opcional.
- `src/components/shared/states/ErrorState.tsx` — icono + mensaje + botón "Reintentar" (`onRetry?`).

### 5. `ListSkeleton`
- `src/components/shared/states/ListSkeleton.tsx` — props `rows` (default 5), `variant` ('table' | 'card').
- Basado en `Skeleton` de shadcn.

### 6. Wrappers de Dialog
- `src/components/shared/dialogs/ConfirmActionDialog.tsx` — confirmación simple (`variant: 'default' | 'destructive'`).
- `src/components/shared/dialogs/DeleteConfirmDialog.tsx` — reusa/consolida `DoubleConfirmDeleteDialog` (typable ELIMINAR). Si ya cubre el caso, sólo re-exportar con nombre nuevo.
- `src/components/shared/dialogs/DocumentPreviewDialog.tsx` — viewer PDF (iframe/pdf.js) sobre `Dialog` base.

### 7. `columnBuilders`
- `src/components/shared/dataTable/columnBuilders.tsx` — helpers tipados para `DataTable`:
  - `statusColumn({ accessor, domain })` — usa `StatusBadge`.
  - `clientColumn({ accessor })` — `toTitleCase` + truncate.
  - `moneyColumn({ accessor, currencyAccessor })` — `formatCurrency` + `tabular-nums`.
  - `dateColumn({ accessor, format })` — respeta locale es-MX / DD/MM/YYYY.
  - `actionsColumn({ items })` — DropdownMenu estándar con `e.stopPropagation()`.

### 8. `useTableFilters<T>`
- `src/hooks/shared/useTableFilters.ts` — extiende `useListPageState` con:
  - Rango de fechas (`dateFrom`, `dateTo`, `isInRange`).
  - Filtros secundarios tipados (`secondary`).
  - Chips activos derivados (para `UnifiedFiltersBar`).
- Devuelve superconjunto compatible con `useListPageState` para migración incremental.

### 9. `UnifiedFiltersBar`
- `src/components/shared/filters/UnifiedFiltersBar.tsx` — consume `useTableFilters`:
  - Search + estado + chips activos + botón Sheet ("Más filtros") con `MobileFiltersSheet`.
  - Slots `primary`, `secondary` para inputs personalizados.

## Tests
- Un archivo por primitiva bajo `__tests__/`:
  - `StatusBadge.test.tsx` — snapshot por dominio × estado.
  - `LoadingState.test.tsx`, `ErrorState.test.tsx` — render + botón reintentar.
  - `ListSkeleton.test.tsx` — cantidad de filas y variantes.
  - `ConfirmActionDialog.test.tsx` — confirma/cancela; `DeleteConfirmDialog` typable.
  - `columnBuilders.test.tsx` — render de cada builder con `DataTable`.
  - `useTableFilters.test.ts` — search, chips, rango fechas, sync URL.
  - `UnifiedFiltersBar.test.tsx` — chips + apertura sheet.
- Meta de cobertura: cada archivo nuevo > 80 % líneas.

## Detalles técnicos

**Archivos nuevos** (11):
```
src/components/shared/PageContainer.tsx
src/components/shared/StatusBadge.tsx
src/components/shared/states/LoadingState.tsx
src/components/shared/states/ErrorState.tsx
src/components/shared/states/ListSkeleton.tsx
src/components/shared/dialogs/ConfirmActionDialog.tsx
src/components/shared/dialogs/DeleteConfirmDialog.tsx
src/components/shared/dialogs/DocumentPreviewDialog.tsx
src/components/shared/dataTable/columnBuilders.tsx
src/components/shared/filters/UnifiedFiltersBar.tsx
src/hooks/shared/useTableFilters.ts
src/lib/status/statusRegistry.ts
```

**Archivos editados** (2):
```
src/components/shared/PageHeader.tsx  (agregar slots)
src/components/layout/Layout.tsx      (usar PageContainer)
```

**Guardrails**:
- Sólo tokens semánticos (`bg-card`, `text-muted-foreground`, `bg-warning/15`, etc.), nunca `text-white`/`bg-[#..]`.
- `StatusBadge` centraliza colores en `statusRegistry`; los componentes no importan variantes directamente.
- `Power of 10`: cada archivo ≤ 200 líneas; sin `any`; cleanup en effects; paginación N/A aquí.
- `FormDialogShell` como base para `ConfirmActionDialog`/`DeleteConfirmDialog` cuando aplique (mem://style/form-dialog-shell).

**Alcance excluido**:
- Migrar páginas o helpers existentes a las primitivas (eso es Oleada 2+).
- Tocar tokens PDF, edge functions, RLS, negocio.

## Entrega

- Un solo bump de versión (`APP_VERSION` + `CHANGELOG.md`) al cerrar la oleada.
- Verificación: `bun run lint`, `bun run test`, y screenshot rápido de `/inicio` para confirmar que no hay regresión visual (Layout).
- Al terminar, quedamos listos para la Oleada 2 (migración de módulos maduros).
