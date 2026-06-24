## Causa

El input de "Flete base" usa `value={form.flete_base}` con `form.flete_base = 0` por default. Cuando el usuario escribe "5" sobre el "0", queda "05" porque React lo trata como string concatenado al value actual.

## Solución

En `src/features/costeo/components/TarifaNumerosVigenciaFields.tsx`:

- Mostrar cadena vacía cuando el valor es 0 (el caso inicial / placeholder):
  `value={form.flete_base === 0 ? "" : form.flete_base}`
- Agregar `placeholder="0.00"` para no perder pista visual.
- Aplicar el mismo patrón a `dias_libres_demoras` (también arranca en 0) por consistencia. `transit_time_dias` ya usa `?? ""`, no se toca.

La validación `flete_base > 0` ya existe en `calcularErrores`, no requiere cambios.

## Versión

- `src/constants/appVersion.ts` → `13.135.35`
- `CHANGELOG.md` → `[13.135.35]`: "fix: el input de flete base (y días libres) ya no muestra el `0` inicial pegado al monto que se escribe."
