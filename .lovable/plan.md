# Patch 3 — Formatos de moneda y fecha

Revisé el parche contra el código actual. De los 6 arreglos, uno ya está resuelto y otro contradice un estándar que ya tomamos antes. Propongo aplicar 4 arreglos, omitir 2 y dejar constancia en el CHANGELOG.

## Qué se aplica

1. **Moneda duplicada (VB-04, VB-28, VF-11)**
   - Card de totales por periodo (Dirección): quitar el sufijo repetido; queda "MXN 460,868.00" en lugar de "MXN 460,868.00 MXN".
   - Columna "Total" del aging de CxP: quitar el sufijo repetido.
   - KPI de Operaciones: el label pasa de "Profit USD" a "Profit" porque el valor ya trae el prefijo "USD"; se conserva el tooltip con el monto completo.

2. **Fecha sin cero al inicio (VT-08)**
   - Encabezado de Tesorería: "saldos al 17/8/2026" pasa a "17/08/2026" usando el formateador de fechas con día y mes de 2 dígitos.

3. **Hora fantasma "00:00" (VT-27)**
   - Línea de tiempo del portal del cliente: cuando el hito sólo tiene fecha (por ejemplo Zarpe), se muestra "05 ago 2026" sin la hora inventada; los eventos con hora real la conservan.

4. **Montos crudos sin separador de miles (UX-12)**
   - Resumen de conceptos en auditoría: usar el formateador de moneda (o número con 2 decimales cuando no hay moneda) en vez de `toFixed`.
   - Nota de flete LCL manual en cotizaciones: "@ USD 1,234.50" con separador de miles.

## Qué se omite y por qué

- **FIX 3 (selector de mes desfasado, VT-14): ya está corregido.** El generador de meses hoy construye la etiqueta desde año/mes numéricos sin pasar por `Date`, que es exactamente el remedio del parche.
- **FIX 2 (posición del signo negativo, VT-22): no aplicar.** El parche quiere "-MXN 33,060.00", pero el formateador global ya normaliza deliberadamente a "MXN -33,060.00" para todas las monedas (decisión previa B-053). Meter un helper `formatNeto` sólo en Tesorería crearía dos formatos de negativo en la misma app, que es justo el problema que se quiere evitar. Si prefieres el otro estilo, lo correcto es cambiarlo una sola vez en el formateador global y no por pantalla — dime y lo planteo aparte.

## Notas técnicas

- Sin cambios en `src/lib/formatters/*` ni en lógica de negocio: sólo presentación.
- No se crea `src/features/tesoreria/domain/formatNeto.ts`.
- Archivos a editar: `TotalesPeriodoCard.tsx`, `cxpAgingColumns.tsx`, `Operaciones.tsx`, `Tesoreria.tsx`, `PortalEmbarqueTimeline.tsx`, `diffConceptos.ts`, `buildCostosLCLManual.ts`.
- Verificación: `vitest` de los tests afectados (auditoría, LCL, proyección) y chequeo de tipos.
- Bump de `APP_VERSION` a `13.633.0` y entrada en `CHANGELOG.md`.
