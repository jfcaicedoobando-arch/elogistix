# Permitir pegar fecha en el modal "Registrar pago"

## Diagnóstico

El campo "Fecha de pago" usa `DatePickerMx` (`src/components/ui/date-picker-mx.tsx`). Hoy sólo acepta captura con máscara `DD/MM/AAAA`:

- El handler `handleChange` llama `applyMask`, que **borra todo lo no numérico**.
- Si el usuario pega `2026-07-07`, `07-Jul-2026`, `7 de julio 2026` o incluso `07/07/2026` con caracteres extra, la máscara reordena mal los dígitos (ej. `2026-07-07` → dígitos `20260707` → `20/26/0707` inválido).
- Por eso "pegar" no funciona: la máscara está pensada sólo para tecleo secuencial.

**Analogía:** el input es como un buzón con ranuras fijas para día/mes/año. Cuando pegas, los dígitos caen en la ranura equivocada.

## Cambios propuestos

### 1. `src/components/ui/date-picker-mx-helpers.ts`
Agregar `parseFlexible(raw: string): string | null` que intenta varios formatos comunes y devuelve ISO `YYYY-MM-DD`:
- `DD/MM/YYYY` y `D/M/YYYY` (con `/`, `-` o `.` como separador).
- `YYYY-MM-DD` / `YYYY/MM/DD` (ISO).
- `DD MMM YYYY` y `DD de MMMM de YYYY` en español (ene, feb, … o enero, febrero, …) — opcional pero útil para copiar/pegar desde estados de cuenta.
- Fallback: `new Date(raw)` sólo si el resultado es válido y tiene los 3 componentes claros (para evitar interpretaciones ambiguas de EE.UU. tipo `07/07/2026`).

Mantener `parseDisplay` (estricto `DD/MM/YYYY`) intacto para no romper la validación en `blur`.

### 2. `src/components/ui/date-picker-mx.tsx`
Añadir `onPaste` al `<input>`:

- Preventa el evento.
- Toma `e.clipboardData.getData("text")`.
- Intenta `parseFlexible(pegado)`.
- Si es válido: setea `text = isoToDisplay(iso)`, `onChange(iso)`, `setInvalid(false)`.
- Si no: cae al comportamiento actual (aplica máscara sobre lo pegado, para que al menos los dígitos entren).

No cambia contrato (`value` sigue siendo ISO) ni afecta al selector de calendario.

### 3. Tests
- `src/components/ui/__tests__/date-picker-mx-helpers.test.ts` (o el existente si ya hay): agregar casos para `parseFlexible` con `"2026-07-07"`, `"7/7/2026"`, `"07.07.2026"`, `"07-07-2026"`, `"7 de julio de 2026"`, y entradas inválidas (`"foobar"`, `""`).
- Test de integración ligero para `DatePickerMx`: simular `paste` de `"2026-07-07"` y verificar que `onChange` recibe `"2026-07-07"`.

### 4. Metadatos
- Bump `APP_VERSION` a `13.213.27`.
- Entrada en `CHANGELOG.md`: "DatePickerMx acepta pegar fechas en formatos ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY y texto en español."

## Alcance

- Cambio afecta **todos** los inputs `DatePickerMx` de la app (proformas, embarques, cotizaciones, etc.), no sólo el modal de pago. Es una mejora general segura.
- No modifica esquemas, servicios ni RLS.
- No toca lógica de negocio de pagos.

## Verificación

- En "Registrar pago" pegar `2026-07-07` → aparece `07/07/2026`.
- Pegar `7/7/2026` → aparece `07/07/2026`.
- Pegar `hola mundo` → se ignora (o cae al filtro de dígitos, sin romper el campo).
- Tecleo manual y selección de calendario siguen funcionando igual.
