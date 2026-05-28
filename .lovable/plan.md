## Problema

En el wizard de embarques (`StepCostosPrecios.tsx`), los campos **Subtotal** y **Cantidad** de Conceptos de Costo / Venta usan `<Input type="number" step="0.01">` con `onChange={e => update(..., Number(e.target.value))}`.

Esto falla con decimales en es-MX porque:
- El navegador en locale mexicano acepta coma decimal (`1,5`), pero `Number("1,5")` devuelve `NaN` → el campo se vacía.
- Al escribir `1.` (punto pendiente), `Number("1.")` = `1`, así que el `.` se "come" y nunca puedes seguir tecleando decimales.
- Las flechas spinner y el scroll-to-change siguen activos (mismo problema que ya arreglamos en cotización LCL/Aérea).

Ya existe el componente `src/components/shared/NumericInput.tsx` (creado en 12.0.0-rc.11) que resuelve exactamente esto: estado interno tipo string, `inputMode="decimal"`, normaliza en blur, sin spinners.

## Cambios

1. **`src/components/embarque/StepCostosPrecios.tsx`**
   - Reemplazar los 3 `<Input type="number">` por `<NumericInput>`:
     - Conceptos de Costo → `Subtotal` (`decimals`)
     - Conceptos de Venta → `Cantidad` (entero, `decimals={false}`)
     - Conceptos de Venta → `Subtotal` (`decimals`)
   - Mantener clases existentes (`text-sm`) y handlers `updateConceptoCosto / updateConceptoVenta`.
   - Los campos de Tipo de Cambio USD/EUR también pasan a `NumericInput` (mismo problema, son decimales) usando `setValue` de RHF en lugar de `register`.

2. **`src/constants/appVersion.ts`** → bump a `12.0.0-rc.12`.

3. **`CHANGELOG.md`** → entrada nueva:
   ```
   ## [12.0.0-rc.12] - 2026-05-28
   - Fix: campos de monto/cantidad en Conceptos de Costo y Venta del wizard de embarques ahora aceptan decimales correctamente (NumericInput), sin spinners ni scroll accidental.
   ```

## Fuera de alcance

- No se toca la lógica de cálculo (`aUSD`, `sumarEnUSD`, `utilidadEstimada`).
- No se modifican los conceptos de cotización (`ConceptoRowUSD/MXN`) — ya tienen su propio manejo string + regex que sí funciona con decimales.
- No se cambia el schema ni el form state de RHF.
