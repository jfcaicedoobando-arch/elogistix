# Auditoría UI/UX Fase 8 — Portal Cliente, Dashboards y Administración (v8.99.19)

**Sí hay mejoras pendientes.** No son bugs críticos, pero existen inconsistencias visibles en módulos que aún no habían pasado por las fases previas.

## Hallazgos

### 1. Dashboard Operativo · Tablas con nombres en CAPS
Inconsistencia: `AlertasDemoraCard` y `ProximosArribosCard` ya aplican `toTitleCase` al cliente, pero estas tres no:
- `src/components/dashboard/ProfitTable.tsx` — columna Cliente renderiza `e.cliente_nombre` crudo.
- `src/components/dashboard/EmbarquesActivosTable.tsx` — columna Cliente cruda.
- `src/components/operaciones/OperacionesWidgets.tsx` — celda `c.cliente_nombre` cruda.
- `src/components/operaciones/ClienteExpandible.tsx` — `cliente.nombre` crudo.

Resultado: en el mismo dashboard se ven "Indimex Trading" en una card y "INDIMEX TRADING" en la tabla justo debajo.

### 2. Portal Cliente · Empty states inconsistentes
`PortalEmbarques.tsx`, `PortalCotizaciones.tsx`, `PortalFacturas.tsx` usan bloques manuales de "no hay resultados" con icono + texto, en lugar del componente `EmptyState` ya estandarizado en el sistema interno (Fase anterior). Romper la consistencia entre app interna y portal.

### 3. Portal · Detalle de Embarque y Cotización
- `PortalEmbarqueDetalle.tsx` líneas 169-171: ETD/ETA renderizan `embarque.etd || "—"` (string ISO `2026-04-30`) en lugar de `formatDate(embarque.etd)`. Inconsistente con las cards de arriba que sí formatean.
- `PortalCotizacionDetalle.tsx` línea 105: `cot.fecha_vigencia || "—"` también ISO crudo.
- Header del portal cotización pasa `clienteNombre={cot.cliente_nombre}` sin Title Case.

### 4. Administración · Usuarios y Organizaciones
- `Admin/Usuarios.tsx` y `admin-org/Usuarios.tsx`: badge de rol muestra el slug interno (`super_admin`, `operador`) en minúsculas con guión bajo. Debería mostrar "Super Admin", "Operador", etc.
- Email mostrado como string crudo (sin tooltip). En `admin-org/Usuarios.tsx` el rol "cliente" no aparece en el `Select` de cambio de rol pero sí puede aparecer en la columna "Rol actual" — desincronización menor.
- `AdminOrganizaciones.tsx`: nombre de organización render directo (puede venir en MAYÚSCULAS desde DB) — falta `toTitleCase`.
- Falta un "Confirm dialog" o aviso cuando se cambia el rol de un usuario en `admin-org/Usuarios.tsx` — actualmente cambia directo al seleccionar (acción destructiva sin confirmación).

### 5. Configuración Org · Tabs en mobile (viewport actual 742px)
`admin-org/Configuracion.tsx`: 7 tabs con `flex-wrap h-auto gap-1` — en 742px las tabs se rompen a 2 filas, pero el indicador activo no se diferencia bien. Funcional pero apretado. Mejora menor: agregar `text-xs` a las labels en mobile o icon-only debajo de breakpoint sm.

### 6. Configuración Org · Sin "guardar pendiente"
El botón "Guardar Cambios" siempre está habilitado, incluso sin cambios. Sería ideal un estado dirty para deshabilitarlo y prevenir guardados innecesarios.

## Plan de Trabajo (v8.99.19)

1. **Title Case en dashboards** (impacto visual inmediato):
   - `ProfitTable.tsx`, `EmbarquesActivosTable.tsx`: aplicar `toTitleCase(e.cliente_nombre)` con `title=` para nombre original.
   - `OperacionesWidgets.tsx`, `ClienteExpandible.tsx`: aplicar `toTitleCase`.

2. **Portal · EmptyState component**:
   - Reemplazar los bloques manuales de "no encontrado" en `PortalEmbarques.tsx`, `PortalCotizaciones.tsx`, `PortalFacturas.tsx` por `<EmptyState>` con su icono correspondiente y la acción "Limpiar filtros" cuando aplique.

3. **Portal · Formato de fechas**:
   - `PortalEmbarqueDetalle.tsx` tab Resumen: aplicar `formatDate(embarque.etd)` y `formatDate(embarque.eta)`.
   - `PortalCotizacionDetalle.tsx`: aplicar `formatDate(cot.fecha_vigencia)`.
   - `PortalCotizacionHeader`: aplicar `toTitleCase(clienteNombre)`.

4. **Administración**:
   - Crear (o reutilizar si existe) un mapa `roleLabels` en `src/lib/ui/uiMappings.ts`: `super_admin → "Super Admin"`, `admin → "Admin"`, `operador → "Operador"`, `viewer → "Visor"`, `cliente → "Cliente"`. Aplicar en badges de Admin/Usuarios y admin-org/Usuarios.
   - `AdminOrganizaciones.tsx`: aplicar `toTitleCase` al nombre de la organización.
   - `admin-org/Usuarios.tsx`: agregar diálogo de confirmación al cambiar de rol (similar al patrón ya existente con `DoubleConfirmDeleteDialog`, pero un solo paso). Alternativa más simple: usar `confirm()` o un `AlertDialog` ligero que muestre "¿Cambiar rol de X de Operador a Admin?" con Cancelar/Confirmar.

5. **Configuración Org · estado dirty**:
   - En `useConfiguracionState`, agregar un estado `isDirty` que se active al primer `set(...)` y se resetee al guardar. Deshabilitar botón "Guardar Cambios" cuando `!isDirty`.
   - Tabs: en mobile (`<sm`), reducir el texto de las labels o esconder el ícono para que quepan en una sola fila si es posible (bajo prioridad).

6. **Changelog v8.99.19** documentando los 5 grupos.

## Detalles Técnicos

- Para `roleLabels`, exportar como `Record<AppRole, string>` desde `uiMappings.ts` y consumir en ambos paneles de usuarios.
- Para el confirm de cambio de rol: optar por un `AlertDialog` minimalista con estado local `pendingRoleChange: { userId; from; to } | null`.
- El estado `isDirty` se puede implementar comparando `JSON.stringify(s)` con `JSON.stringify(initialS)` cargado en `useConfiguracionState`, o con un boolean que se setea en el setter compuesto y se limpia al `handleSave` exitoso.
- `EmptyState` en portal: confirmar que el componente existente acepta `icon` como prop (ya creado en Fase 5) — si no, extender la API.

## Archivos a Modificar (estimación)

- `src/components/dashboard/ProfitTable.tsx`
- `src/components/dashboard/EmbarquesActivosTable.tsx`
- `src/components/operaciones/OperacionesWidgets.tsx`
- `src/components/operaciones/ClienteExpandible.tsx`
- `src/pages/portal/PortalEmbarques.tsx`
- `src/pages/portal/PortalCotizaciones.tsx`
- `src/pages/portal/PortalFacturas.tsx`
- `src/pages/portal/PortalEmbarqueDetalle.tsx`
- `src/pages/portal/PortalCotizacionDetalle.tsx`
- `src/components/portal/cotizacion/PortalCotizacionHeader.tsx`
- `src/lib/ui/uiMappings.ts`
- `src/pages/admin/AdminUsuarios.tsx`
- `src/pages/admin-org/Usuarios.tsx`
- `src/pages/admin/AdminOrganizaciones.tsx`
- `src/hooks/configuracion/useConfiguracionState.ts`
- `src/pages/admin-org/Configuracion.tsx`
- `src/content/changelog/v8/chunks/0.ts`
