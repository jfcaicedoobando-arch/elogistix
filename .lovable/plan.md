

## Plan: Rediseñar layout de filas en SeccionCostosInternosPLLocal

### Archivo único: `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`

**1. Catálogos de conceptos por moneda**
```ts
const CONCEPTOS_USD = ['Flete Marítimo', 'Flete Aéreo', 'Embalaje', 'Coordinación de Recolección', 'Seguro de Carga', 'Cargos en Origen', 'Handling', 'Desconsolidación', 'Revalidación', 'Otro'];
const CONCEPTOS_MXN = ['Manejo', 'Demoras', 'Cargos en Destino', 'Almacenaje', 'Entrega Nacional', 'Otro'];
```

**2. Reemplazar la Table con layout de filas en dos líneas**

Eliminar el `<Table>` completo. Reemplazar con un div de filas donde cada fila usa `border-b border-slate-100 py-3 space-y-1`:

- **Línea 1** (`flex items-center gap-2`):
  - Concepto: `Select` con catálogo por moneda, `min-w-[180px] flex-1`. Si el valor actual no está en el catálogo, agregarlo como opción (para datos existentes).
  - Proveedor: `Input` `w-[120px]`
  - Unidad: `Select` `w-[110px]`

- **Línea 2** (`flex items-center gap-2`):
  - Cantidad: `Input` `w-[80px]`
  - Costo Unit.: `Input` `w-[110px]`
  - P. Venta: `Input` `w-[110px]`
  - Profit: `span` readonly `w-[100px]`
  - %: badge `w-[70px]`
  - Eliminar: botón `w-8`

**3. Totales**

Reemplazar el `TableFooter` con un div resumen al final con los mismos totales en `flex justify-between`.

**4. Mantener sin cambios**: Resumen P&L collapsible, lógica de cálculo, funciones helper.

**5. Changelog**: Entrada v4.10.1

