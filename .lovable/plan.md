
## Cambio

Actualizar los valores por defecto usados al **generar un borrador de factura** para que todos partan de:

- **Uso CFDI:** `G03` (Gastos en general) — ya está así.
- **Método de pago:** `PPD` (Pago en parcialidades o diferido).
- **Forma de pago:** `99` (Por definir).

Estos defaults son sólo el arranque del borrador; el contable los puede cambiar antes de timbrar.

## Puntos de código a tocar

Hay dos flujos que crean borradores y ambos hardcodean los valores:

1. `src/features/proformas/hooks/useConvertirProformaDirecto.ts` (líneas 41-43)  
   Conversión "un clic" proforma → borrador.  
   `metodoPago: "PUE"` → `"PPD"`  ·  `formaPago: "03"` → `"99"`  ·  usoCfdi ya es `G03`.

2. `src/features/facturacion/components/DialogNuevaFacturaManual.tsx` (línea 43)  
   Diálogo de factura manual.  
   `formaPago: "03"` → `"99"`  ·  `metodoPago: "PUE"` → `"PPD"`  ·  usoCfdi ya es `G03`.  
   Se preserva la lógica que sobrescribe `usoCfdi` con el `uso_cfdi_default` del cliente si existe (línea 79).

3. Fallbacks de coherencia (para que si un borrador viejo o proceso legacy llega sin valores, el diálogo de timbrar y el form de datos fiscales muestren los mismos defaults):
   - `src/features/facturacion/hooks/useTimbrarFacturaDialog.ts` — `?? "03"` → `?? "99"`, `?? "PUE"` → `?? "PPD"`.
   - `src/features/facturacion/domain/datosFiscalesForm.ts` — `?? "PUE"` → `?? "PPD"` (ahí no hay fallback de forma_pago).

No se toca la base de datos (las columnas no tienen `DEFAULT` y los INSERT siempre pasan valor explícito desde el código).

## Housekeeping

- `CHANGELOG.md`: entrada nueva.
- `src/constants/appVersion.ts`: bump patch a `13.213.45`.

## Analogía

Antes el sistema pre-llenaba el recibo como "pago al contado hoy con transferencia" (PUE + 03). Ahora lo pre-llena como "pago diferido, forma por definir" (PPD + 99), que es lo que necesita quien va a facturar y cobrar después.

## Archivos a tocar

- `src/features/proformas/hooks/useConvertirProformaDirecto.ts`
- `src/features/facturacion/components/DialogNuevaFacturaManual.tsx`
- `src/features/facturacion/hooks/useTimbrarFacturaDialog.ts`
- `src/features/facturacion/domain/datosFiscalesForm.ts`
- `CHANGELOG.md`
- `src/constants/appVersion.ts`
