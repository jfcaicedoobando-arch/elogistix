# Fase 2 — Migración de columnas a ColumnDef nativo (tablas core)

## Alcance acordado

**Migrar ahora** (tablas core de operación):

1. `src/components/embarque/embarqueColumns.tsx` → `EmbarqueRow`
2. `src/components/cotizacion/cotizacionesColumns.tsx` → `Cotizacion`
3. `src/components/cliente/clienteColumns.tsx` + `TablaContactos.tsx` + `TabPortalCliente.tsx`
4. `src/pages/proveedores/Proveedores.tsx` (columnas inline) + `ProveedorDetalle.tsx`
5. `src/components/facturacion/proformasColumns.tsx`
6. `src/components/facturacion/proyeccionColumns.tsx`
7. `src/components/facturacion/huecoFacturacionColumns.tsx`
8. `src/components/embarque/facturacion/HistorialProformas.tsx`
9. `src/components/embarque/facturacion/HistorialFacturas.tsx`
10. `src/components/embarque/TabCostos.tsx`
11. `src/components/embarque/TabDocumentos.tsx`
12. `src/pages/clientes/Clientes.tsx` (columnas inline)
13. `src/pages/facturacion/Facturacion.tsx` (columnas inline)

**Diferir al ticket** (`docs/migracion-tabla-fase2.md`): dashboard, configuración, admin, portal, auditoría, papelera, reportes, idempotencia.

## Patrón de migración

Cada archivo cambia de:

```text
DataTableColumn<T>[] con { key, header, render, sortable, sortValue, width, align, sticky, className }
```

a:

```text
defineColumns<T>([
  { id, header, accessorFn?, cell: ({ row }) => ...,
    enableSorting?, sortingFn?, sortDescFirst?,
    meta: { width, align, sticky, stickyRight, className, headerClassName } }
])
```

Equivalencias mecánicas (ya documentadas en `docs/tables.md`):

- `key` → `id`
- `sortValue: r => r.x` → `accessorFn: r => r.x` (+ `sortingFn` automático del adapter; se replica con `localeCompare("es-MX", { sensitivity: "base" })` para strings)
- `render` → `cell: ({ row }) => ...(row.original)`
- estilos visuales → `meta`

## Pasos

1. **Crear helpers compartidos** en `src/components/shared/dataTable/`:
   - `sortingFns.ts` — `esCollator` (locale "es-MX", sensitivity "base") + `sortByString<T>()`, `sortByDate<T>()`, `sortByNumber<T>()` reutilizables. Replican el comportamiento del adapter para que cada call-site no escriba comparadores ad-hoc.
2. **Migrar `embarqueColumns.tsx`** (referencia para el resto). Validar contra `Embarques.tsx` con su `sortMode="server"` + `controlledSort`.
3. **Migrar `cotizacionesColumns.tsx`** y verificar `Cotizaciones.tsx` (también server-side).
4. **Migrar bloques de cliente** (3 archivos). Estos son sort cliente.
5. **Migrar Proveedores** (`Proveedores.tsx` + `ProveedorDetalle.tsx`). Mover columnas inline a archivos dedicados `proveedoresColumns.tsx` y `proveedorDetalleColumns.tsx` para mantener el patrón.
6. **Migrar facturación**: `proformasColumns`, `proyeccionColumns`, `huecoFacturacionColumns`, `HistorialProformas`, `HistorialFacturas`, columnas inline de `Facturacion.tsx`.
7. **Migrar `TabCostos.tsx` y `TabDocumentos.tsx`** del detalle de embarque.
8. **Migrar columnas inline de `Clientes.tsx`** a `clienteColumns.tsx` (ya existente).
9. **Ampliar pruebas de regresión** en `src/components/shared/dataTable/__tests__/DataTable.regression.test.tsx`:
   - Caso usando un arreglo `ColumnDef<T>[]` nativo (no legacy) para confirmar que la rama `isLegacyColumns=false` funciona.
   - Caso de sort client-side con `accessorFn` + `sortingFn` para validar que el sort por defecto del adapter sigue ordenando igual que la ruta nativa.
10. **Crear `docs/migracion-tabla-fase2.md`** con:
    - Resumen del refactor 9.1.0–9.1.x.
    - Tabla de equivalencias `DataTableColumn` ↔ `ColumnDef`.
    - Lista de archivos **migrados** (cerrados) y **pendientes** (con prioridad: P1 admin/configuración, P2 dashboard/reportes, P3 portal/papelera/auditoría/idempotencia).
    - Criterio de cierre: cuando la lista esté vacía, eliminar `columnAdapter.ts`, `isLegacyColumns`, `legacyToColumnDef`, el tipo `DataTableColumn<T>`, y la rama `toColumnDefs` que decide entre legacy/nativo. Mantener únicamente `ColumnDef<T>[]` + `defineColumns`.
11. **Versionar**: `APP_VERSION` → `9.2.0` (cambio minor: migración masiva de columnas, sin breaking change público porque el adapter sigue activo).
12. **Changelog**: nueva entrada `9.2.0` describiendo qué archivos se migraron, helpers nuevos, doc creado y la promesa de eliminar el adapter al cerrar el ticket.

## Lo que NO entra

- Eliminar el adapter / `DataTableColumn<T>` (se hace cuando el ticket cierre).
- Tocar RPCs, filtros server-side, paginación o el motor de virtualización.
- Migrar archivos diferidos al ticket (admin, configuración, dashboard, reportes, portal, auditoría, papelera, idempotencia).
- Cambios visuales — el render debe quedar pixel-equivalente.

## Riesgos y mitigación

- **Sort divergente entre legacy y nativo**: mitigado con helpers `sortByString/Date/Number` que replican exactamente el `localeCompare("es-MX")` del adapter, más un test de regresión que compara ambos caminos.
- **Identidad de columnas memoizadas**: cada `defineColumns(...)` debe vivir fuera del render o dentro de `useMemo` con deps explícitas (igual que hoy). Sin cambios de patrón.
- **`accessorFn` vs `cell`**: cuando el render NO depende del valor crudo (badges, componentes complejos), igual usar `accessorFn` para que el sort cliente funcione; el `cell` ignora el valor y usa `row.original`.

## Tamaño estimado

13 archivos migrados + 1 doc nuevo + 1 archivo de helpers + 2 tests nuevos + versionado. Sin cambios en hooks, controllers ni servicios.
