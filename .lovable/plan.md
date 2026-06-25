## Resultado de la auditoría

Busqué en todo `src/` los inputs de fecha nativos. La migración previa a `DatePickerMx` está **completa**: cero ocurrencias de `<input type="date">` (solo queda la mención del comentario en `date-picker-mx.tsx`).

Sin embargo, encontré **5 inputs nativos de fecha/periodo que aún muestran formato en inglés** según el idioma del navegador:

### `type="datetime-local"` (muestra MM/DD/YYYY hh:mm AM/PM)
1. `src/features/crm/components/NuevaActividadDialog.tsx:143` — campo "Fecha"
2. `src/features/crm/components/quickCreate/QuickCreateActividadPopover.tsx:78` — campo "Fecha"

### `type="month"` (muestra "Month YYYY" en inglés)
3. `src/features/comisiones/routes/Comisiones.tsx:87` — selector de periodo
4. `src/features/comisiones/components/DialogGenerarLiquidacion.tsx:62` — selector de periodo
5. `src/features/presupuesto/components/TabVsReal.tsx:50` — selector de periodo

## Plan de remediación

### Paso 1 — Crear `DateTimePickerMx`
Nuevo componente en `src/components/ui/date-time-picker-mx.tsx` que combine `DatePickerMx` (DD/MM/YYYY) con un input de hora (`HH:mm`), devolviendo un string ISO compatible con el actual `datetime-local`. Reutilizar la estética de `DatePickerMx`.

Aplicar en:
- `NuevaActividadDialog.tsx`
- `QuickCreateActividadPopover.tsx`

### Paso 2 — Crear `MonthPickerMx`
Nuevo componente en `src/components/ui/month-picker-mx.tsx`: popover con `Calendar` en modo selección de mes (o dos selects mes/año en español: "Enero 2026"). Devuelve `YYYY-MM` para mantener compatibilidad con la lógica existente de periodos.

Aplicar en:
- `Comisiones.tsx`
- `DialogGenerarLiquidacion.tsx`
- `TabVsReal.tsx`

### Paso 3 — Versionado
- Bump `APP_VERSION` a `13.135.58`.
- Agregar entrada en `CHANGELOG.md` describiendo la auditoría y los nuevos pickers.

## Notas técnicas

- Ambos nuevos componentes deben respetar la guía de estilo (semantic tokens, sin colores hardcoded) y exponer la misma API que un `Input` controlado (`value` + `onChange(string)`) para minimizar cambios en los call sites.
- Locale `es-MX` con `date-fns/locale/es`.
- No tocar la lógica de negocio (cálculos de comisiones/presupuesto) — solo presentación.

¿Apruebas que proceda con los 3 pasos, o prefieres solo los `datetime-local` (paso 1) y dejar los `type="month"` como están?