## Ventana relativa para selector de meses (24 atrás / 12 adelante)

**Archivo:** `src/lib/domain/proyeccionFacturacion/meses.ts`

Cambios:
- `generarMesesDisponibles(hoy)`: reemplazar `inicio` fijo (`new Date(2026, 3, 1)`) por `new Date(hoy.getFullYear(), hoy.getMonth() - 24, 1)`. `fin` se mantiene en `hoy + 12 meses`.
- `mesActualKey(hoy)`: quitar el piso de Abril 2026; devolver siempre el mes actual real.
- Actualizar el JSDoc para reflejar "ventana de 24 meses atrás a 12 adelante".

**Extras obligatorios:**
- Bump `APP_VERSION` en `src/constants/appVersion.ts` a `12.0.0-rc.16`.
- Entrada en `CHANGELOG.md` (root): selector de meses ahora muestra ventana relativa (−24 / +12), permitiendo seleccionar meses anteriores a Abril 2026.

**Fuera de alcance:** filtros de tabs, lógica de RPCs, columnas o cualquier otra parte del rediseño de Prefacturación.