# Mejorar el traspaso entre cuentas propias

## Problemas actuales

1. El botón se llama solo "Traspaso", no se reconoce a simple vista.
2. El acomodo del formulario se desfasa: cuando origen y destino tienen monedas distintas aparece un bloque extra de tipo de cambio dentro de una rejilla de dos columnas, y eso empuja el campo de comisión a otro renglón.
3. El tipo de cambio solo acepta 2 decimales, cuando los bancos usan 4 (18.4235).
4. El monto que se va a recibir se muestra como un texto pequeño escondido debajo del tipo de cambio; es difícil de entender.

## Qué se va a hacer

1. **Botón más claro**: renombrar a "Traspaso entre cuentas" en la pantalla de cuentas bancarias.

2. **Acomodo estable**: reorganizar el formulario en secciones fijas para que los campos no salten al cambiar de moneda:
   - Cuentas: origen y destino (dos columnas).
   - Importe: monto y fecha.
   - Conversión (solo si las monedas difieren): tipo de cambio, en su propio renglón completo.
   - Comisión y referencia/notas siempre en la misma posición.

3. **Tipo de cambio con 4 decimales**: usar el campo numérico que ya existe en el proyecto para 4 decimales (el mismo de conceptos de factura), en lugar del campo de dinero de 2 decimales.

4. **Resumen del traspaso claro**: bloque destacado al final del formulario que muestre, en renglones legibles:
   - Sale de la cuenta origen: monto en su moneda.
   - Tipo de cambio aplicado (4 decimales) con la leyenda de la paridad, por ejemplo "1 USD = 18.4235 MXN".
   - Comisión, si se capturó.
   - **Llega a la cuenta destino**: monto final resaltado en la moneda destino.

## Notas técnicas

- Archivos: `TesoreriaCuentas.tsx` (etiqueta), `DialogTraspasoCuentas.tsx` (layout + resumen), nuevo `TraspasoResumen.tsx` para el bloque de resumen, `useTraspasoForm.ts` solo si hace falta exponer el desglose ya calculado.
- Sustituir `MoneyInput` por `NumericInput decimals={4}` únicamente en el campo de tipo de cambio; el monto y la comisión siguen con 2 decimales.
- Mantener `FormDialogShell` + `FormDialogSection` como shell estándar, tokens semánticos, sin estilos en línea, componentes ≤200 líneas.
- Sin cambios en la RPC `registrar_traspaso_bancario` ni en su validación de fecha, corte, bloqueo y conversión. Es solo UI/UX.
- La lógica de conversión y redondeo sigue viniendo de los helpers existentes (`tcPar`), no se recalcula en la vista.
- Pruebas focalizadas: unitarias del cálculo del resumen (USD→MXN con TC de 4 decimales y comisión) y typecheck/lint de los archivos tocados. CI completo queda para GitHub Actions.
