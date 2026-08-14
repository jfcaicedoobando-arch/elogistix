# Captura rápida de fechas con teclado numérico (DatePickerMx)

Objetivo: que un operador de contabilidad capture fechas sin soltar el teclado numérico ni abrir el calendario, y que el campo avise (sin bloquear) cuando la fecha cae en un día inhábil en México.

## Qué ya funciona hoy

- Máscara tolerante `DD/MM/YYYY` que respeta separadores tecleados (`1/3/2026` → `01/03/2026`) y captura corrida (`01032026`).
- Pegado flexible (ISO, `13 de marzo de 2026`), validación de año bisiesto por redondeo de fecha real, `F4`/`Alt+Flecha abajo` para abrir el calendario, `Escape` para cerrarlo.

## Qué se agrega

### 1. Salto discreto entre slots (`## / ## / ####`)

- El input trabaja con tres segmentos. Al completar dos dígitos de día, el cursor salta solo al mes; al completar el mes, salta al año — sin teclear `/`.
- `Flecha izquierda` / `Flecha derecha` mueven entre segmentos; al enfocar un segmento se selecciona completo, así el siguiente dígito lo sobrescribe.
- `Retroceso` sobre un segmento vacío regresa al anterior.
- Se conserva la captura corrida y el pegado actuales: quien ya teclea `01032026` o `1/3/26` no nota cambios.

### 2. Aceleradores de teclado

- `T` (o `H`, por "Hoy"): escribe la fecha de hoy en zona México.
- `+` / `-` (y `Flecha arriba` / `Flecha abajo`): incrementan o decrementan el segmento activo — día, mes o año — con acarreo correcto (31/01 + 1 día = 01/02; 31/03 - 1 mes = 28/02 o 29/02 en bisiesto).
- Si el campo está vacío, `+`/`-` parten de hoy.
- `Re Pág` / `Av Pág`: salto de un mes; con `Shift`, de un año.
- Se respetan `min` y `max`: los aceleradores no salen del rango permitido.

### 3. Aviso de día inhábil (ámbar, no bloquea)

- Nuevo módulo de días festivos oficiales calculados en código según el artículo 74 de la Ley Federal del Trabajo: 1 de enero, primer lunes de febrero, tercer lunes de marzo, 1 de mayo, 16 de septiembre, tercer lunes de noviembre, 1 de diciembre en año de transmisión del Poder Ejecutivo (2024, 2030, …) y 25 de diciembre.
- Debajo del campo aparece una nota ámbar cuando la fecha capturada es festivo o fin de semana: por ejemplo "Día inhábil: 16/09 Independencia" o "Día inhábil: sábado". La fecha se guarda normalmente; el error rojo sigue reservado para fechas inválidas o fuera de rango.
- El aviso es opcional por campo (`avisarInhabil`), activado donde tiene sentido contable (fechas de pago, vencimiento, timbrado) y apagado donde no (fechas de zarpe, arribo).
- El calendario marca visualmente los días inhábiles, sin deshabilitarlos.

### 4. Los tres pickers

La misma máquina de segmentos y aceleradores se comparte en:

- `DatePickerMx` (`DD/MM/YYYY`).
- `DateTimePickerMx` — sólo la porción de fecha; la hora se queda como está.
- `MonthPickerMx` — dos segmentos `MM/YYYY`, con `T` = mes actual y `+`/`-` por segmento; sin aviso de día inhábil (no aplica a un mes).

## Detalles técnicos

- Nuevo `src/lib/date/festivosMx.ts`: `esFestivoMx(iso)`, `nombreFestivoMx(iso)`, `esDiaInhabilMx(iso)`, `siguienteDiaHabilMx(iso)`. Funciones puras sobre `YYYY-MM-DD`, sin `Date` local ambiguo — se apoya en `parseLocalMx`/`isoUtcDay` de `src/lib/date/mx.ts` para no correrse de día en CI.
- Nuevo `src/components/ui/date-picker-mx-segmentos.ts`: modelo puro de segmentos (`segmentoEnPos`, `rangoSegmento`, `escribirDigito`, `ajustarSegmento`) más `src/components/ui/date-picker-mx-atajos.ts` para el mapeo de teclas. `date-picker-mx-keys.ts` sólo delega, para no crecer.
- `useDatePickerMxValor` recibe el segmento activo y expone `setSelection` mediante el `inputRef` existente; la lógica de aviso vive en un `useMemo` derivado del ISO confirmado, sin estado nuevo.
- `picker-mx-shell.ts` gana la clase del aviso ámbar usando el token `warning` ya existente — sin colores hardcodeados.
- Accesibilidad: el aviso se anuncia con `aria-describedby` (`role="status"`), separado del `aria-invalid` de error.
- Tests Vitest nuevos: segmentos y acarreo (bisiestos 2024/2100, `31/01 +1 mes`, límites `min`/`max`), festivos (lunes móviles, año de transmisión de poder, fines de semana) y un test de integración de teclado sobre `DatePickerMx` (`T`, `+`, `-`, salto de slots).
- Sin cambios de base de datos ni de RLS. Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
