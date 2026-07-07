# Fecha editable con teclado en `DatePickerMx`

## Objetivo
Los usuarios quieren capturar fechas más rápido escribiendo en `DD/MM/YYYY` sin abrir el calendario, manteniendo la opción visual actual.

## Cambios (solo UI, un archivo)
**`src/components/ui/date-picker-mx.tsx`** — Reemplazar el `<Button>` disparador por un contenedor con:

1. **`<input type="text" inputMode="numeric">`** con máscara `DD/MM/YYYY` (10 caracteres, autoformateo insertando `/` al escribir).
   - Placeholder: `DD/MM/AAAA`.
   - `value` interno controlado; en cada tecla se reformatea.
   - `onBlur` / Enter: valida día, mes, año (rango 1900–2100) y llama `onChange(iso)`. Si es inválido, revierte al último valor válido y muestra estado de error visual (`border-destructive` + `aria-invalid`).
   - Backspace elimina la barra automáticamente.
2. **Botón icono calendario** a la izquierda que abre el `Popover` con el `<Calendar>` actual (comportamiento intacto). Al seleccionar en el calendario, se sincroniza el texto del input.
3. **Botón `X`** para limpiar (se conserva).
4. Sincronización: cuando cambia `value` (ISO) desde afuera, se refleja como `DD/MM/YYYY` en el input.
5. Accesibilidad: `aria-label`, `role="group"`, mensaje de error con `aria-describedby` cuando la fecha es inválida.

## Fuera de alcance
- No se cambia la API pública (`value` ISO / `onChange(iso)`), por lo que los ~N usos actuales del componente siguen funcionando sin tocarse.
- No se toca lógica de negocio ni validaciones de formularios que consumen el ISO.

## Validación
- Tipos con `tsgo`.
- Prueba manual en el modal donde se seleccionó (`Fecha de descarga` en Garantías): escribir `07/07/2026`, borrar, pegar `7/7/26` (se auto-formatea si es válido, se rechaza si no).
- Revisar que abrir el calendario y seleccionar sigue sincronizando el input.

## Changelog
Bump patch de `APP_VERSION` + entrada en `CHANGELOG.md` describiendo el input de fecha editable.
