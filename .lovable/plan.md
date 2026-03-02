

## Plan v3.13.6 — Reestructurar columnas de Conceptos de Venta

### Resumen
Cambiar la tabla de Conceptos de Venta para que tenga la misma estructura que Conceptos de Costo: Concepto, Proveedor, Monto, Moneda, Subtotal (auto), Total (auto), y botón eliminar. Se elimina el checkbox de IVA, y los campos `cantidad`/`precioUnitario` se reemplazan por `proveedor`/`monto`. No se toca la tabla de Conceptos de Costo.

### Cambios

#### 1. `src/data/conceptoTypes.ts`
Reemplazar los campos `cantidad` y `precioUnitario` por `proveedor` (string) y `monto` (number) en `ConceptoVentaLocal`. Quitar `aplicaIva`. El tipo queda idéntico a `ConceptoCostoLocal`.

#### 2. `src/hooks/useConceptosForm.ts`
- Actualizar valor inicial de venta: `{ id, concepto, proveedor: '', monto: 0, moneda: 'MXN', total: 0 }`
- `calcTotalVenta`: subtotal = monto, total = monto * 1.16 (IVA fijo 16%)
- Quitar referencia a `aplicaIva` en cálculos de venta
- `subtotalVenta` = suma de `monto`, `ivaVenta` = subtotalVenta * 0.16, `totalVentaConIva` = subtotalVenta + ivaVenta

#### 3. `src/components/embarque/StepCostosPrecios.tsx`
Solo la sección de Conceptos de Venta (líneas 85-122):
- Grid: `[1fr_1fr_100px_90px_100px_100px_40px]`
- Headers: Concepto | Proveedor | Monto | Moneda | Subtotal | Total | (delete)
- Campos: Select concepto, Input proveedor, Input monto, Select moneda, span subtotal (=monto), span total (=monto*1.16), botón eliminar
- Quitar checkbox IVA

#### 4. `src/pages/Changelog.tsx`
Agregar entrada v3.13.6 al inicio del array.

### Archivos modificados
- `src/data/conceptoTypes.ts`
- `src/hooks/useConceptosForm.ts`
- `src/components/embarque/StepCostosPrecios.tsx`
- `src/pages/Changelog.tsx`

