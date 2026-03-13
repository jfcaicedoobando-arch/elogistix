

# DataTable Sorting & Column Sizing — v5.18.0

## What Changes

Upgrade the shared `DataTable` component to support **click-to-sort columns** and **explicit column widths**, then apply both across all 8 table consumers.

---

## Implementation

### 1. Extend `DataTableColumn` interface

Add two optional fields to the column definition:

```typescript
export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  width?: string;              // NEW — e.g. "w-[120px]", "min-w-[200px]", "w-auto"
  sortable?: boolean;          // NEW — enables click-to-sort
  sortValue?: (item: T) => string | number | null;  // NEW — extract comparable value
  render: (item: T) => React.ReactNode;
}
```

### 2. Add sort state & logic to `DataTable`

- Internal `useState` for `sortKey` and `sortDirection` (`'asc' | 'desc' | null`).
- When a sortable header is clicked: toggle asc → desc → none.
- Sort `data` array using `sortValue` (or fall back to `render` result as string).
- Render `ArrowUpDown` / `ArrowUp` / `ArrowDown` icon from lucide next to sortable headers.
- Header gets `cursor-pointer select-none` styling when sortable.

### 3. Apply `width` to columns

- Pass `col.width` as an additional class to both `<TableHead>` and `<TableCell>`.

### 4. Configure columns across all pages

| Page | Columns with widths | Sortable columns |
|------|-------------------|-----------------|
| **Embarques** | Expediente `w-[110px]`, BL `w-[120px]`, Cliente `min-w-[160px]`, Modo `w-[90px]`, Origen/Destino `w-[120px]`, Contenedor `w-[100px]`, ETD/ETA `w-[90px]`, Estado `w-[110px]`, Operador `w-[100px]` | Expediente, Cliente, ETD, ETA, Estado, Operador |
| **Cotizaciones** | Folio `w-[100px]`, Cliente `min-w-[160px]`, Modo `w-[80px]`, Ruta `min-w-[160px]`, Subtotal `w-[110px]`, Estado `w-[100px]`, Vigencia `w-[100px]`, Fecha `w-[130px]` | Folio, Cliente, Subtotal, Estado, Fecha |
| **Clientes** | Nombre `min-w-[180px]`, RFC `w-[130px]`, Ciudad `w-[150px]`, Contacto `w-[140px]`, Teléfono `w-[120px]` | Nombre, RFC, Ciudad |
| **Proveedores** | Nombre `min-w-[180px]`, RFC `w-[130px]`, Contacto `w-[140px]`, Moneda `w-[80px]` | Nombre, RFC |
| **Facturación** (facturas) | # Factura `w-[110px]`, Expediente `w-[110px]`, Cliente `min-w-[160px]`, Monto `w-[110px]`, Moneda `w-[70px]`, Emisión `w-[100px]`, Vencimiento `w-[100px]`, Estado `w-[100px]` | # Factura, Monto, Emisión, Vencimiento, Estado |
| **Facturación** (gastos) | Similar sizing | Proveedor, Monto, Vencimiento |
| **Usuarios** | Email `min-w-[200px]`, Fecha `w-[140px]`, Rol `w-[100px]`, Cambiar rol `w-[160px]` | Email, Fecha, Rol |
| **Dashboard tables** | Keep current sizing, add sort to Profit and Margen columns | Profit, Margen |

### 5. Visual details

- Sort indicator: small `ArrowUp`/`ArrowDown` icon (h-3 w-3) inline with header text, muted color.
- Unsorted sortable columns show `ArrowUpDown` at reduced opacity.
- Header hover effect: `hover:text-foreground` transition on sortable columns.
- No layout shift — icons are always rendered, just opacity changes.

---

## Files Modified

- `src/components/DataTable.tsx` — core sort logic + width support
- `src/pages/Embarques.tsx` — column config
- `src/pages/Cotizaciones.tsx` — column config
- `src/pages/Clientes.tsx` — column config
- `src/pages/Proveedores.tsx` — column config
- `src/pages/Facturacion.tsx` — column config
- `src/pages/Usuarios.tsx` — column config
- `src/components/dashboard/ProfitTable.tsx` — column config
- `src/components/dashboard/EmbarquesActivosTable.tsx` — column config

