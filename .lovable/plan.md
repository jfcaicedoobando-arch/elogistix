

## Plan: Toggle "Aplica IVA" y totales por sección — v3.13.3

### Cambios

#### 1. `src/data/conceptoTypes.ts`
- Agregar `aplicaIva: boolean` a `ConceptoVentaLocal` y `ConceptoCostoLocal`

#### 2. `src/hooks/useConceptosForm.ts`
- Valores iniciales con `aplicaIva: false`
- Actualizar tipo de `value` en update functions para aceptar `boolean`
- Agregar cálculos derivados:
  - `ivaCosto`: suma de `monto * 0.16` donde `aplicaIva === true`
  - `totalCostoConIva`: `totalCosto + ivaCosto`
  - `ivaVenta`: suma de `(cantidad * precioUnitario) * 0.16` donde `aplicaIva === true`
  - `totalVentaConIva`: `subtotalVenta + ivaVenta`
- Actualizar `utilidadEstimada` para usar totales con IVA: `totalVentaConIva - totalCostoConIva`

#### 3. `src/components/embarque/StepCostosPrecios.tsx`
- Agregar columna "IVA" con `<Checkbox>` en cada fila de costos y venta
- Al final de cada sección mostrar 3 líneas: Subtotal, IVA, Total
- Actualizar props para recibir `ivaCosto`, `totalCostoConIva`, `ivaVenta`, `totalVentaConIva`
- Actualizar grid columns para acomodar la nueva columna

#### 4. `src/pages/NuevoEmbarque.tsx` y `src/pages/EditarEmbarque.tsx`
- Pasar los nuevos valores calculados a `StepCostosPrecios`

#### 5. `src/pages/Changelog.tsx`
- Entrada v3.13.3

### Archivos a modificar
- `src/data/conceptoTypes.ts`
- `src/hooks/useConceptosForm.ts`
- `src/components/embarque/StepCostosPrecios.tsx`
- `src/pages/NuevoEmbarque.tsx`
- `src/pages/EditarEmbarque.tsx`
- `src/pages/Changelog.tsx`

