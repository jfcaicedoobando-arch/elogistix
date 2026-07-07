# Alinear tablas de Facturación al design language

## Problema

Las 7 bandejas del cockpit de Facturación (`Por timbrar`, `Por enviar`, `Por cobrar`, `Vencidas`, `REP pendientes`, `Proformas listas`, `Por facturar / Hueco`) usan un componente propio `TablaBandejaSimple` con **columna de acción en cada fila** (`[Timbrar]`, `[Enviar]`, `[Pagar]`, `[Convertir]`…). El resto de la app usa el `DataTable` estándar con **drilldown de fila completa** al detalle del registro y las acciones viviendo dentro del detalle. Esto rompe consistencia visual (bordes, densidad, striping, hover, sort, empty state) y de interacción (no se puede Ctrl-click, no hay teclado, no hay hover indicando navegación).

Analogía: hoy la bandeja es un formulario con botoncitos al final de cada renglón — como una lista de tickets con checkbox de "resolver aquí mismo". Vamos a convertirla en un radar: cada renglón es un enlace al expediente, y las acciones se ejecutan dentro del expediente (que ya las tiene todas).

## Alcance

**Sí:**
- Reemplazar `TablaBandejaSimple` por el `DataTable` estándar en las 7 bandejas.
- Quitar la columna de acción por fila en todas.
- Habilitar drilldown de fila (`getRowHref`) al detalle correspondiente, **sin** auto-abrir dialogs.
- Añadir drilldown al `BandejaPorFacturar` (hueco) que hoy usa `DataTable` pero sin `getRowHref`.
- Eliminar `TablaBandejaSimple.tsx` y su test si existe.
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

**No:**
- No se toca la lógica de datos (hooks, queries, filtros).
- No se toca el detalle de factura / proforma / embarque.
- No se cambian columnas ni ordenamiento (sólo el vehículo visual).
- No se remueve el parámetro `?accion=` de otros lugares (por si alguien lo usa via link directo); simplemente ya no lo generamos desde las bandejas.

## Cambios por archivo

### 1. Eliminar
- `src/features/facturacion/components/bandejas/TablaBandejaSimple.tsx`

### 2. Migrar las 6 bandejas de `TablaBandejaSimple` → `DataTable`

Patrón común nuevo (ejemplo `BandejaPorTimbrar`):

```tsx
import { DataTable, defineColumns } from "@/components/shared/DataTable";
// ...
const columns = defineColumns<FilaPorTimbrar>([
  { id: "num", header: "Folio interno", cell: ({ row }) => (
      <span className="font-mono">{row.original.numero.startsWith("BORRADOR-") ? "Sin folio" : row.original.numero}</span>) },
  { id: "cli", header: "Cliente", accessorFn: r => r.cliente_nombre },
  { id: "fe",  header: "Emisión",  cell: ({ row }) => formatDate(row.original.fecha_emision) },
  { id: "tot", header: "Total", meta: { align: "right" },
    cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda) },
]);
return (
  <DataTable
    columns={columns}
    data={data ?? []}
    isLoading={isLoading}
    emptyMessage="No hay facturas pendientes de timbrar. ✅"
    rowKey={(r) => r.id}
    getRowHref={(r) => `/facturacion/${r.id}`}
  />
);
```

Destino de drilldown por bandeja (todos SIN `?accion=`):

| Bandeja | `getRowHref` |
|---|---|
| `BandejaPorTimbrar` | `/facturacion/{id}` |
| `BandejaPorEnviar`  | `/facturacion/{id}` |
| `BandejaPorCobrar`  | `/facturacion/{id}` |
| `BandejaVencidas`   | `/facturacion/{id}` |
| `BandejaRepPendientes` | `/facturacion/{factura_id}` |
| `BandejaProformasListas` | `/proformas/{id}` |

- Ninguna conserva columna de acción.
- `BandejaProformasListas` deja de invocar `useConvertirProformaDirecto`; el usuario convierte desde el detalle de la proforma (donde ya existe el botón).
- Se eliminan imports ahora sin uso (`useNavigate`, iconos de acción, `useConvertirProformaDirecto`, `useOrgFilter` en proformas listas).

### 3. `BandejaPorFacturar.tsx` (hueco)
Añadir `getRowHref={(r) => \`/embarques/${r.embarque_id}?tab=facturacion\`}` al `DataTable` existente. No se toca nada más.

### 4. Verificar / actualizar tests
- Buscar tests que rendericen las bandejas y ajusten al selector de fila (`role=link` en lugar de botón "Timbrar/Pagar/Enviar/Convertir").
- Eliminar test de `TablaBandejaSimple` si existe.

### 5. Versionado
- `src/constants/appVersion.ts` → bump patch (v13.213.5).
- `CHANGELOG.md` → entrada breve: "Bandejas de Facturación migradas al DataTable estándar con drilldown de fila; se elimina la columna de acción por fila."

## Verificación

- `bunx vitest run src/features/facturacion` verde.
- Preview: entrar a `/facturacion`, revisar las 7 pestañas. Cada fila navega al detalle limpio al click, teclado (Enter) y Ctrl+click abre en nueva pestaña. Ninguna fila muestra botón de acción a la derecha.

## Detalles técnicos

- `DataTable` acepta `getRowHref` → aplica `role=link`, tabindex, y soporta Ctrl+click (`useDrilldownRow` / `rowNav.ts`).
- Sort y density heredan defaults del `DataTable` (comfortable, striped=true), consistentes con el resto de módulos.
- Las columnas migran de `ColumnaBandeja<T>` a `ColumnDef<T>` vía `defineColumns`; alineación derecha con `meta: { align: "right" }`.
- Se respeta la regla del proyecto: cada fila = un drilldown; nada de "resolver aquí mismo".
