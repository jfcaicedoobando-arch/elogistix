# Tope de vinculación: una factura no puede cubrir más de lo que vale

## El problema

En el modal **Capturar factura de proveedor** es posible marcar varios conceptos de costo de embarque cuya suma supera el importe de la factura, y el sistema deja guardar. Hoy pasa porque:

- El semáforo de cuadre solo mira los montos vinculados cuando **no** hay conceptos de CFDI ni manuales; si el XML/PDF trajo partidas, los vínculos quedan fuera del cálculo.
- La validación previa al guardado se salta cualquier revisión en cuanto detecta que hay al menos un vínculo marcado.
- Ni el formulario ni el guardado comparan la suma vinculada contra el subtotal de la factura.

Resultado: una factura de, por ejemplo, 1,000 puede quedar aplicada a conceptos por 3,500, inflando lo "cubierto" del embarque.

## La solución

1. **Cálculo del asignado**: sumar siempre los montos vinculados y compararlos contra el **subtotal** de la factura (sin IVA ni retenciones), que es la base en que se registran los conceptos de costo.
2. **Indicador en vivo** en la sección "Vincular a costos de embarque": muestra `Subtotal · Asignado · Disponible`. Si el asignado excede el subtotal, el bloque se pinta en rojo con el excedente exacto y una explicación breve.
3. **Bloqueo duro del guardado**: con exceso, el botón "Guardar factura" queda desactivado y, si se intenta enviar, aparece un aviso con el monto que sobra y qué hacer (bajar un monto o desmarcar un concepto). Tolerancia de 0.01 como en el resto del módulo.
4. **Cada monto por línea también topado**: al escribir un monto en una línea vinculada, no puede exceder el monto original del concepto de costo ni dejar el total por arriba del subtotal; el campo marca el error en el momento.
5. El comportamiento cuando no hay vínculos no cambia: el semáforo de cuadre sigue funcionando igual para CFDI y conceptos manuales.

## Detalles técnicos

- Nuevo helper puro `src/features/cxp/utils/topeVinculacion.ts`: `calcularTopeVinculacion(subtotal, vinculos)` → `{ asignado, disponible, excedente, excede }`, usando `currency.js` y tolerancia 0.01 (mismo patrón que `cuadreConceptos.ts`).
- `useCuadreCaptura.ts`: expone el resultado del tope además del cuadre existente, sin alterar `resolverConceptosParaCuadre`.
- `useNuevaFacturaProveedorForm.guard.ts`: se agrega la verificación del tope **antes** del early-return por `hayVinculos`, con `notifyError` y un `method` propio.
- `useNuevaFacturaProveedorForm.ts`: `puedeGuardar` incorpora `!tope.excede`.
- UI: nuevo componente pequeño `TopeVinculacionBar.tsx` renderizado en `VincularEmbarqueSection.tsx`; `VincularListaConceptos.tsx` marca en rojo el input que rebasa su monto original. Ambos archivos se mantienen bajo 200 líneas (se extrae si hace falta).
- Tests unitarios del helper y del guard (casos: exacto, dentro, excedido por 0.005, excedido claramente, sin vínculos).
- `APP_VERSION` + entrada en `CHANGELOG.md`.

## Fuera de alcance

No se toca el trigger de aprobación en base de datos ni la vinculación de facturas ya capturadas; este cambio cubre el modal de captura.
