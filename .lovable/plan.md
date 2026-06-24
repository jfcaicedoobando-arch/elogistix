## Causa

- `dias_libres_demoras` arranca en **7** (default), no en 0 — por eso mi fix anterior (`=== 0 ? ""`) no aplica: el usuario sigue viendo "7" y al teclear queda "710".
- `transit_time_dias` arranca en `null`, así que ya muestra vacío, pero si el usuario captura un valor y luego quiere cambiarlo, vuelve a tener el mismo problema de concatenación.

## Solución (uniforme y simple)

Agregar `onFocus={(e) => e.currentTarget.select()}` a los tres inputs numéricos del formulario (`tarifa-flete`, `tarifa-dias-libres`, `tarifa-transito`). Al enfocar el campo, el valor actual queda seleccionado y la primera tecla lo reemplaza completo.

- Mantiene el placeholder y el default funcional (no se borra al renderizar).
- No cambia la lógica de guardado.
- Patrón estándar para inputs `type="number"` con default no-cero.

## Versión

- `src/constants/appVersion.ts` → `13.135.36`
- `CHANGELOG.md` → `[13.135.36]`: "fix: los inputs numéricos de tarifa (flete, días libres, tránsito) seleccionan su valor al enfocarse para que el siguiente texto lo reemplace."
