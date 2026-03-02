

## Plan: Hacer el campo Total editable — v3.13.5

### Problema
El campo "Total" en cada fila de costos y venta es un `<span>` calculado automáticamente. El usuario necesita poder escribir el monto total directamente.

### Solución
Reemplazar el `<span>` calculado por un `<Input type="number">` editable. Agregar un campo `total` a los tipos de datos. El total se auto-calcula cuando el usuario cambia Monto/Cantidad/PrecioUnitario/IVA, pero también se puede editar manualmente.

### Cambios

#### 1. `src/data/conceptoTypes.ts`
- Agregar `total: number` a `ConceptoVentaLocal` y `ConceptoCostoLocal`

#### 2. `src/hooks/useConceptosForm.ts`
- Inicializar `total: 0` en ambos tipos
- En las funciones `updateConceptoVenta` y `updateConceptoCosto`: cuando cambian `monto`, `cantidad`, `precioUnitario` o `aplicaIva`, auto-recalcular `total`. Cuando cambia `total` directamente, usar el valor ingresado
- Los sumarios de sección (subtotal, IVA, totalConIva) se calculan a partir de los `total` almacenados por fila

#### 3. `src/components/embarque/StepCostosPrecios.tsx`
- Línea 69: reemplazar `<span>` por `<Input type="number">` vinculado al campo `total` de cada fila
- Línea 108: mismo cambio para venta

#### 4. `src/pages/Changelog.tsx`
- Entrada v3.13.5

### Archivos a modificar
- `src/data/conceptoTypes.ts`
- `src/hooks/useConceptosForm.ts`
- `src/components/embarque/StepCostosPrecios.tsx`
- `src/pages/Changelog.tsx`

