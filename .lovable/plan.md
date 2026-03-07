

## Plan: Corregir TablaConceptosGenerico.tsx

### Cambios en `src/components/cotizacion/TablaConceptosGenerico.tsx`

1. **IVA dinámico** — Reemplazar texto hardcodeado `"IVA (16%)"` en el `TableHead` (línea 38) y footer (línea 70) con `` `IVA (${TASA_IVA * 100}%)` ``.

2. **Key estable** — Línea 48: cambiar `key={indice}` por `key={concepto.id ?? concepto.descripcion ?? indice}` (el tipo no tiene `id`, así que usar `descripcion` como primario y `indice` como fallback).

3. **Respetar `aplica_iva`** — Línea 45: en lugar de aplicar IVA ciegamente a toda fila MXN, verificar `concepto.aplica_iva`:
   ```ts
   const lineIva = (esMXN || concepto.aplica_iva) ? lineSubtotal * TASA_IVA : 0;
   ```
   Para MXN todos aplican IVA obligatorio (consistente con el parent que suma subtotal completo × IVA). Para USD, solo si `aplica_iva` es true.

4. **Consistencia de redondeo** — Usar `calcularIVA()` de `financialUtils` en lugar de multiplicación inline para alinear con el cálculo del parent:
   ```ts
   import { TASA_IVA, calcularSubtotal, calcularIVA } from "@/lib/financialUtils";
   const lineSubtotal = calcularSubtotal(concepto.cantidad, concepto.precio_unitario);
   const lineIva = (esMXN || concepto.aplica_iva) ? calcularIVA(lineSubtotal) : 0;
   ```

### Cambio en `src/pages/Changelog.tsx`

Agregar entrada v4.23.1 con descripción del fix.

### Notas técnicas
- `ConceptoVentaCotizacion` no tiene campo `id`, por lo que la key usa `descripcion` + `indice` como fallback.
- El parent (`useCotizacionWizardForm`) calcula `ivaMXN = calcularIVA(subtotalMXN)` sobre la suma total, no por línea. Usar la misma función `calcularIVA` por línea garantiza consistencia cuando se suman.

