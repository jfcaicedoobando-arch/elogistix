# Captura de fecha con teclado + navegación por teclado en el modal de pago

## Qué está pasando hoy (verificado en el código)

En "Registrar pago" (`DialogRegistrarPago` → `PagoFormFields` → `DatePickerMx`):

1. **El botón del calendario va antes del input.** En `date-picker-mx.tsx` el botón "Abrir calendario" se renderiza primero, así que al tabular el foco cae en el icono y hay que tabular otra vez para escribir la fecha.
2. **La "X" de limpiar se mete en el orden de tabulación** y aparece/desaparece según haya texto, así que el orden cambia mientras el usuario escribe.
3. **Escribir `1/3/2026` no funciona.** `applyMask` borra los separadores y reacomoda los dígitos: `1/3/2026` se convierte en `13/20/26`. El parseo tolerante (`parseFlexible`, que sí acepta `D/M/YYYY`) sólo corre al pegar o al salir del campo, cuando el texto ya venía deformado.
4. **La etiqueta no está ligada al campo.** `<Label>Fecha de pago</Label>` no tiene `htmlFor` y el input no recibe `id`: no se puede enfocar dando clic en la etiqueta ni se anuncia bien con lector de pantalla. Lo mismo pasa con Forma de pago, Moneda, Referencia y Notas.
5. **Enter no guarda.** El modal no usa `<form>`, y en el campo de fecha Enter se cancela. No hay forma de guardar sin llegar al botón con el mouse.
6. **Al abrir el modal el foco no llega al primer campo** (Radix lo deja en el botón de cerrar), así que hay que tabular varias veces antes de escribir.

## Qué se va a construir

### 1. Campo de fecha usable 100% con teclado

- Reordenar el interior: **input primero**, luego el icono de calendario y la "X".
- El botón de calendario y la "X" salen del orden de tabulación normal (`tabIndex={-1}`), pero siguen siendo accesibles: se agrega el atajo **`Alt+Flecha abajo` / `F4`** sobre el input para abrir el calendario y **`Esc`** para cerrarlo y regresar el foco al input.
- **Máscara tolerante al escribir:** si el usuario teclea un separador (`/`, `-`, `.`) el día/mes se completa con cero a la izquierda; `1/3/2026` queda `01/03/2026` mientras escribe. Se sigue aceptando la captura corrida de 8 dígitos (`01032026`).
- Al salir del campo, el parseo tolerante actual sigue como red de seguridad, ahora sobre texto ya bien formado.
- El input acepta `id` desde el padre y se enlaza con la etiqueta.
- Anillo de foco visible en el contenedor del campo cuando el input está enfocado.

### 2. Modal de pago navegable con teclado

- Envolver el cuerpo en un `<form onSubmit>`: **Enter guarda** desde cualquier campo de texto (respetando el estado deshabilitado / validaciones ya existentes); el botón Guardar pasa a `type="submit"` y Cancelar a `type="button"`.
- **Foco inicial** en el campo de Fecha de pago al abrir.
- Orden de tabulación natural: fecha → forma de pago → monto → moneda → cuenta → referencia → notas → Cancelar → Guardar.
- Etiquetas ligadas con `htmlFor`/`id` en todos los campos del formulario, y el error de fecha anunciado con `aria-describedby`.
- `Esc` sigue cerrando (ya lo maneja el diálogo de Radix); Enter dentro del campo de fecha primero confirma la fecha y luego envía.

### 3. Alcance del cambio

`DatePickerMx` se usa en muchas pantallas, así que la mejora de teclado beneficia a todas. Los cambios de `<form>` y foco inicial se aplican a este modal de pago; si funciona bien, se replica al modal de pago a proveedor en un paso posterior.

## Detalles técnicos

- `src/components/ui/date-picker-mx-helpers.ts`: nueva función de máscara que respeta separadores tecleados y hace padding de día/mes; se conservan `applyMask` (para captura corrida), `parseDisplay` y `parseFlexible` intactos en su contrato.
- `src/components/ui/date-picker-mx.tsx`: reorden del DOM, `tabIndex={-1}` en botones auxiliares, manejo de `Alt+ArrowDown`/`F4`/`Esc`, `id` en el input, `focus-within` en el contenedor. Se mantiene bajo 200 líneas (si crece, el manejo de teclado sale a un hook `useDatePickerKeyboard`).
- `src/components/ui/date-picker-mx-calendar.tsx`: recibe una ref/callback para devolver el foco al input al cerrar el popover.
- `src/features/facturacion/components/PagoFormFields.tsx`: `id` + `htmlFor` en cada campo.
- `src/features/facturacion/components/DialogRegistrarPago.tsx` y `DialogRegistrarPagoParts.tsx`: `<form>` con `onSubmit={handleGuardar}`, `autoFocus` en el primer campo, botones con `type` explícito.
- Tests: unitarios de la máscara nueva (`1/3/2026`, `01032026`, `31/2/2026` inválido) y un test de teclado del modal (tabular hasta Guardar, Enter envía, Alt+Flecha abajo abre el calendario).
- Al cerrar: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.
