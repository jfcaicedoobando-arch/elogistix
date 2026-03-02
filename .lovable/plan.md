

## Plan: Reestructurar sección Costos y Pricing — v3.13.2

### Cambios

#### 1. `src/data/embarqueConstants.ts`
- Reemplazar `CONCEPTOS_MARITIMOS` por `CONCEPTOS_EMBARQUE` con las 6 opciones: Flete Marítimo, Embalaje, Coordinación de Recolección, Seguro de Carga, Manejo, Demoras

#### 2. `src/components/embarque/StepCostosPrecios.tsx`
- **Reordenar secciones**: Costos primero, Venta después
- **Conceptos de Costos** — columnas en orden: Concepto (dropdown), Proveedor (texto libre en lugar de dropdown de proveedores), Monto, Moneda (solo MXN/USD), Total, Eliminar
- **Conceptos de Venta** — solo reemplazar el campo de concepto (texto libre o `CONCEPTOS_MARITIMOS`) por el dropdown con las 6 opciones fijas. Mantener columnas actuales
- Eliminar la condición `modo === 'Marítimo'` ya que el dropdown ahora aplica siempre
- Eliminar prop `proveedoresDb` (ya no se usa dropdown de proveedores en costos)

#### 3. `src/data/conceptoTypes.ts`
- Cambiar `proveedorId` a `proveedor` (string, texto libre) en `ConceptoCostoLocal`

#### 4. `src/hooks/useConceptosForm.ts`
- Actualizar valor inicial de costo para usar `proveedor: ''` en lugar de `proveedorId: ''`

#### 5. Archivos que pasan `proveedoresDb` a StepCostosPrecios
- `NuevoEmbarque.tsx` y `EditarEmbarque.tsx`: dejar de pasar `proveedoresDb`; actualizar referencias de `proveedorId` a `proveedor`

#### 6. `src/pages/Changelog.tsx`
- Entrada v3.13.2

### Archivos a modificar
- `src/data/embarqueConstants.ts`
- `src/data/conceptoTypes.ts`
- `src/hooks/useConceptosForm.ts`
- `src/components/embarque/StepCostosPrecios.tsx`
- `src/pages/NuevoEmbarque.tsx`
- `src/pages/EditarEmbarque.tsx`
- `src/pages/Changelog.tsx`

