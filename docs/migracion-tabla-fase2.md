# Migración de tablas — Fase 2

Versión: **9.2.0** · Fecha: 2026-05-19

Continuación de la Fase 1 (9.1.0) que migró el motor interno de `DataTable` /
`VirtualDataTable` a `@tanstack/react-table` + `@tanstack/react-virtual`
manteniendo el adapter de `DataTableColumn<T>` para no romper a los callers.

La Fase 2 convierte los **13 archivos del core operativo** a la API nativa
`ColumnDef<T>` (vía `defineColumns<T>`) y deja todo lo demás documentado en
el ticket pendiente. El adapter legacy sigue activo hasta el cierre de ese
ticket.

---

## Alcance ejecutado (13 archivos)

| Módulo            | Archivos migrados                                                                 |
|-------------------|-----------------------------------------------------------------------------------|
| Embarques         | `src/components/embarque/embarqueColumns.tsx`                                     |
| Cotizaciones      | `src/components/cotizacion/cotizacionesColumns.tsx`                               |
| Clientes          | `src/components/cliente/clienteColumns.tsx`, `TablaContactos.tsx`, `TabPortalCliente.tsx`, columnas inline en `src/pages/clientes/Clientes.tsx` |
| Proveedores       | `src/pages/proveedores/Proveedores.tsx`, `src/pages/proveedores/ProveedorDetalle.tsx` |
| Facturación       | `proformasColumns.tsx`, `proyeccionColumns.tsx`, `huecoFacturacionColumns.tsx`, `HistorialProformas.tsx`, `HistorialFacturas.tsx`, columnas inline (`facturaColumns`, `gastoColumns`) en `src/pages/facturacion/Facturacion.tsx` |
| Tabs de embarque  | `src/components/embarque/TabCostos.tsx`, `src/components/embarque/TabDocumentos.tsx` |

---

## Tabla de equivalencias `DataTableColumn<T>` ↔ `ColumnDef<T>`

| Legacy (`DataTableColumn<T>`) | Nativo (`ColumnDef<T>` + `meta`) |
|------|------|
| `key: "expediente"` | `id: "expediente"` |
| `header: "Expediente"` | `header: "Expediente"` |
| `render: (row) => …` | `cell: ({ row }) => …` (usar `row.original`) |
| `sortable: true` | `enableSorting: true` |
| `sortValue: (r) => r.numero` (string) | `accessorFn: (r) => r.numero` + `sortingFn: sortByString<T>((r) => r.numero)` |
| `sortValue: (r) => r.total` (número) | `accessorFn` + `sortingFn: sortByNumber<T>(…)` (+ opcional `sortDescFirst: true`) |
| `sortValue: (r) => r.fecha` (fecha) | `accessorFn` + `sortingFn: sortByDate<T>(…)` |
| `width: "w-[120px]"` | `meta: { width: "w-[120px]" }` |
| `align: "right"` | `meta: { align: "right" }` |
| `sticky: true` | `meta: { sticky: true }` (o `stickyRight: true`) |
| `className: "…"` | `meta: { className: "…" }` |
| `headerClassName: "…"` | `meta: { headerClassName: "…" }` |

Los helpers viven en `src/components/shared/dataTable/sortingFns.ts` y
replican exactamente el comportamiento del adapter legacy:

- `sortByString` → `Intl.Collator("es-MX", { sensitivity: "base" })`
  (insensible a acentos y mayúsculas).
- `sortByNumber` → resta directa, null-safe.
- `sortByDate` → comparación numérica de timestamps; strings inválidos
  caen al final.
- En los tres helpers, `null` / `undefined` van al final sin importar la
  dirección del orden (igual que la API legacy).

---

## Patrón recomendado para nuevas tablas

```tsx
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";

interface Row { id: string; expediente: string; total: number; eta: string | null }

export const columns: ColumnDef<Row, unknown>[] = defineColumns<Row>([
  {
    id: "expediente", header: "Expediente",
    accessorFn: (r) => r.expediente, enableSorting: true,
    sortingFn: sortByString<Row>((r) => r.expediente),
    meta: { width: "w-[130px]", sticky: true, className: "font-medium" },
    cell: ({ row }) => row.original.expediente,
  },
  {
    id: "total", header: "Total",
    accessorFn: (r) => r.total, enableSorting: true,
    sortingFn: sortByNumber<Row>((r) => r.total),
    sortDescFirst: true,
    meta: { width: "w-[120px]", align: "right", className: "tabular-nums" },
    cell: ({ row }) => row.original.total,
  },
  {
    id: "eta", header: "ETA",
    accessorFn: (r) => r.eta, enableSorting: true,
    sortingFn: sortByDate<Row>((r) => r.eta),
    meta: { width: "w-[110px]" },
    cell: ({ row }) => row.original.eta ?? "—",
  },
]);
```

> **No mezclar** `DataTableColumn<T>[]` y `ColumnDef<T>[]` en el mismo
> arreglo. El componente acepta ambas formas, pero la detección es por
> arreglo completo, no por elemento.

Para tablas con orden server-side (Embarques, Cotizaciones, Proveedores)
mantener `sortMode="server"` + `controlledSort` + `onSortChange` igual
que antes; el `id` que se envía al callback es el `id` declarado en el
`ColumnDef`.

---

## Pendientes diferidos (ticket separado)

Se mantienen con el adapter legacy hasta cerrar este ticket. Prioridad
sugerida:

### P1 — Operación cercana al usuario
- Dashboard: `ProfitTable`, `EmbarquesActivos`, otras listas de
  `src/pages/dashboard/`.
- Reportes (`src/pages/reportes/*`).

### P2 — Administración
- Configuración (`src/pages/configuracion/*`).
- Admin global (`src/pages/admin/*`).
- Portal del cliente (`src/pages/portal/*`).

### P3 — Auditoría e infraestructura
- Bitácora / auditoría (`src/pages/auditoria/*`).
- Papelera (`src/pages/papelera/*`).
- Idempotencia y herramientas internas.

---

## Criterio de cierre del adapter

Cuando los pendientes P1–P3 estén migrados:

1. Eliminar `src/components/shared/dataTable/columnAdapter.ts`.
2. Eliminar el tipo `DataTableColumn<T>` de
   `src/components/shared/dataTable/types.ts` (conservar `ColumnAlign` y
   demás tipos visuales reutilizados por `LibreCargaColumnMeta`).
3. Simplificar la detección dual de columnas en `DataTable` /
   `VirtualDataTable` para aceptar únicamente `ColumnDef<T>[]`.
4. Actualizar `docs/tables.md` removiendo la API legacy.
5. Subir a versión mayor (`10.0.0`) por breaking change público.

Hasta ese momento, ambos formatos siguen soportados sin penalización de
rendimiento (el adapter sólo se ejecuta una vez por mount al construir la
instancia de TanStack).
