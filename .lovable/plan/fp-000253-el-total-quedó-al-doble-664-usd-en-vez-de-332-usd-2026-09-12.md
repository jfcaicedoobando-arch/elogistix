# FP-000253: el total quedó al doble (664 USD en vez de 332 USD)

## Qué pasó

La factura OOLU2338327460 del expediente vinculado es por **332 USD**, pero el encabezado dice **664 USD**.

Al revisar sus renglones hay cinco, no cuatro:

```text
OCEAN FREIGHT 1/40HQ        150.00   (capturado hoy 23:58)
EBS EMERGENCY BAF 1/40HQ    120.00   (capturado hoy 23:58)
HSS HI SEC SEAL CH 1/40HQ    12.00   (capturado hoy 23:58)
DOC O/B DOC FEE              50.00   (capturado hoy 23:58)
                            ------
                            332.00
Flete Maritimo              332.00   (renglón de vínculo con el costo del expediente, 10/09)
                            ------
total del encabezado        664.00
```

El quinto renglón no es un cargo del proveedor: es el renglón que el sistema creó cuando se ligó la factura al costo "Flete Marítimo" del expediente. Se está contando como si fuera un cargo más.

## Causa

Cuando se guardan los renglones editados, el sistema borra los renglones anteriores del desglose del proveedor, inserta los nuevos y luego recalcula el encabezado sumando **todos** los renglones de la factura, incluidos los renglones de vínculo con costos. Otras partes del sistema (por ejemplo la validación de aprobación) ya sólo suman el desglose del proveedor, así que el recálculo del encabezado es el único punto que hace doble conteo.

Efecto: cada factura ya ligada a un costo que se re-editó a mano quedó con el encabezado inflado por el importe del vínculo. Bloquea la aprobación y falsea el gasto del expediente.

## Corrección propuesta

1. **Arreglar el recálculo del encabezado**: al guardar los renglones editados, sumar únicamente el desglose del proveedor (renglones sin vínculo a costo) y dejar los renglones de vínculo fuera del subtotal, IVA e IEPS. Si la factura no tiene desglose del proveedor, conservar el comportamiento actual para no dejar el encabezado en cero.
2. **Corregir los datos ya afectados**: recalcular el encabezado de FP-000253 (subtotal y total a 332 USD) y buscar otras facturas activas de la organización donde el encabezado no cuadre con su desglose por esta misma razón, para recalcularlas igual. No se toca ningún importe capturado, ni pagos, IVA, monedas, vínculos con costos ni el historial.
3. **Pruebas**: caso SQL con factura que tiene desglose del proveedor más un renglón de vínculo (el encabezado debe quedar en el desglose, no en la suma de ambos), y caso sin desglose.

## Notas técnicas

- Función a corregir: `public.reemplazar_conceptos_factura_proveedor` (migración nueva + espejo `supabase/schema/cxp/reemplazar_conceptos_factura_proveedor.sql`). El `SELECT` de recálculo debe filtrar `concepto_costo_id IS NULL`, alineándose con `_cxp_validar_aprobacion`.
- El `DELETE` previo ya filtra `concepto_costo_id IS NULL`; ese comportamiento se conserva (los vínculos no se pierden al editar).
- Saneo de datos en la misma migración, acotado a facturas activas no canceladas y sin pagos, comparando encabezado contra Σ(monto × cantidad) del desglose.
- Sin cambios de UI, permisos, RLS ni contratos de servicio.
- Validaciones locales: prueba SQL nueva, `audit:schema-functions`, `audit:manifest`, `db:postcheck`, typecheck, lint focalizado y build. CI/RLS/E2E completos quedan para GitHub Actions.
