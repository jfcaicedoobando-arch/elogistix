# Fase 2 — Tablas responsive + paginación/FAB sin colisiones

## Objetivo
Eliminar el scroll horizontal incómodo en móvil (20:9) en las tablas principales, evitar que el FAB tape la paginación, y dar densidad táctil adecuada sin tocar lógica de negocio.

## Alcance (sólo UI / presentación)

### 1. Nuevo componente `ResponsiveDataTable`
Ruta: `src/components/shared/dataTable/ResponsiveDataTable.tsx`

- Wrapper sobre `DataTable` existente. Acepta los mismos props + uno nuevo opcional:
  - `mobileCard: (row) => ReactNode` — render alternativo en pantallas `<sm` (640px).
  - `mobilePrimary?: string` / `mobileSecondary?: string[]` — atajo para auto-generar tarjetas cuando no se pasa `mobileCard` (toma columnas por id).
- Comportamiento:
  - `<sm`: lista de `<button>`/`<div role="row">` tipo card (border + padding + tap target ≥44px) con `onRowClick` preservado.
  - `≥sm`: renderiza el `DataTable` normal sin cambios.
  - La paginación se renderiza siempre desde el `DataTable` (no duplicar).
- Sin cambios en `DataTable` ni en `VirtualTableParts`.

### 2. Migrar tablas de mayor dolor en móvil
Sólo cambiar la llamada para usar `ResponsiveDataTable` y definir `mobileCard`:
- `src/features/embarques/.../EmbarquesList*` (lista principal)
- `src/pages/cotizaciones/Cotizaciones.tsx`
- `src/pages/proveedores/ProveedorTable.tsx`
- `src/features/crm/routes/leads*` (tabla de leads)
- `src/features/reportes/components/ReportesTablaClientes.tsx`

Cada `mobileCard` muestra: título principal (folio/empresa/cliente), línea secundaria (cliente/estado/fecha), badge de estado a la derecha y monto si aplica. Sin lógica nueva — los datos ya vienen en `row`.

### 3. Paginación + FAB sin colisión
- `src/components/shared/dataTable/DataTablePagination.tsx` (o equivalente): en `<sm` añadir `pb-[env(safe-area-inset-bottom)]` y `mb-20` cuando hay FAB visible (clase utilitaria `data-[fab=true]:mb-20`).
- `src/components/shared/FloatingActionButton.tsx`: ya quedó con safe-area; añadir `aria-label` consistente y `sm:bottom-6` para que en desktop no se mueva.
- En páginas con tabla + FAB (Embarques, Cotizaciones, Proveedores, CRM Leads), pasar `className="pb-24 sm:pb-0"` al contenedor de la tabla para que la última fila no quede tapada.

### 4. Mejora menor de header de tabla en móvil
- `src/components/ui/table.tsx` y `VirtualTableParts.tsx`: cuando la tabla queda en modo desktop dentro de móvil grande (tablet vertical), reducir `text-[11px]` a `text-[10px]` con `sm:text-[11px]`. Cambio puramente cosmético.

## No incluye (queda para fases siguientes)
- Refactor de filtros (Fase 4).
- Páginas legacy sin responsive (Fase 5).
- Tipografía `clamp()` global (Fase 6).
- Dashboard scroll-snap (Fase 3).

## Archivos a tocar (estimado)
- Nuevo: `src/components/shared/dataTable/ResponsiveDataTable.tsx`
- Editar: 5 páginas/tablas listadas arriba + `FloatingActionButton.tsx` + paginación.
- Metadata: `CHANGELOG.md` (entrada `[13.16.0]`) y `src/constants/appVersion.ts`.

## Validación
- `bunx vitest run` enfocado en archivos modificados.
- Screenshot móvil 412×915 en `/embarques`, `/cotizaciones`, `/proveedores`, `/crm/leads`: verificar que no hay scroll horizontal, que cada card es tappable, y que el FAB no tapa la paginación.
