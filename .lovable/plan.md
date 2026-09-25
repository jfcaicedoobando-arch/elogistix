# Proformas bloqueadas por conceptos con IVA "Por definir"

## Qué pasa (confirmado)
Al generar una proforma, la app se niega si algún concepto no tiene su IVA clasificado (16%, 8%, tasa 0%, exento, no objeto). Esa regla está bien: evita adivinar un dato fiscal. El problema es que en el editor del embarque no hay dónde clasificarlo; la única forma es volver a elegir el concepto del catálogo. Afecta sobre todo a:
- fletes en dólares que venían de la cotización con "sin IVA", y
- embarques viejos, de antes de que existiera este dato.

Es como pedirte el sello de un trámite en una ventanilla que no existe.

## Qué se hará (mínimo, sin quitar la regla)
1. En cada línea de venta del editor del embarque (junto al switch de IVA), agregar un selector pequeño de "Tratamiento de IVA": 16%, 8%, Tasa 0%, Exento, No objeto. Se muestra resaltado cuando está "Por definir".
2. Al elegir una opción se guarda el tipo de IVA y la tasa que le corresponde, y se sincroniza el switch.
3. El aviso de la proforma dirá qué conceptos faltan (por nombre) e incluirá un botón para "Editar embarque" en el paso de conceptos.
4. No se clasifica nada en automático, ni por moneda ni por el switch apagado. Los registros existentes no se tocan.

## Decisión que necesito
¿"IVA apagado" en la cotización debe contar como "Tasa 0%" en automático? Por ahora el plan dice **no**: el usuario decide línea por línea.

## Técnico
- Nuevo `SelectTratamientoIva.tsx` (≤80 líneas) usado en `FilaVentaPrecio.tsx`; escribe `tipoIva`, `tasaIvaAplicada` y `aplicaIva` con `setValue(..., {shouldDirty, shouldValidate})`.
- `submitProformaDialog.ts`: el mensaje lista `descripcion` de las filas pendientes. El controlador del diálogo ofrece un enlace a `/embarques/:id/editar?paso=conceptos`.
- El mapper `embarqueToDbConceptos` ya persiste `tipo_iva` cuando viene; no requiere cambios en la base.
- Pruebas: selector (escribe los tres campos), submit (el mensaje nombra los conceptos; se sigue rechazando lo pendiente).
- Sin migraciones, versión, CHANGELOG ni publicación.
