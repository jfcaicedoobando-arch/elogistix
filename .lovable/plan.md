# Etiquetar los importes de conciliación con la moneda real de la cuenta

## Situación actual (verificada)

- La tabla de movimientos de `/tesoreria/conciliacion` formatea Cargo y Abono con `formatCurrency(..., "MXN")` fijo (`movimientoColumns.tsx`, líneas 51 y 62), aunque los movimientos siempre pertenecen a una sola cuenta bancaria que puede ser USD.
- El panel derecho (`PanelConciliacionMovimiento.tsx`) también fija `"MXN"` en el KPI del monto (línea 84) y en el texto del diálogo de ignorar (línea 169).
- La pantalla ya conoce la moneda correcta: `TesoreriaConciliacion.tsx` calcula `cuentaActual` y ya se la pasa a otras secciones (`moneda={cuentaActual?.moneda ?? "MXN"}`).
- `Estado de cuenta` ya lo hace bien: `estadoCuentaColumns.tsx` recibe `moneda` como parámetro. Este cambio simplemente iguala Conciliación a ese estándar.

## Qué se va a cambiar

1. La columna Cargo y la columna Abono de Conciliación muestran la moneda de la cuenta seleccionada (por ejemplo `USD 1,200.00` en una cuenta USD).
2. El panel de detalle del movimiento muestra el monto y el texto de confirmación de "ignorar" en la misma moneda.
3. Sin cambios de lógica financiera: sólo la etiqueta/presentación. No se convierten importes ni se toca el saldo, la conciliación ni los cálculos.

## Detalles técnicos

- `movimientoColumns.tsx`: `crearMovimientoColumns(onVerPago, moneda: string)` y usar `moneda` en los dos `formatCurrency`.
- `TesoreriaConciliacion.tsx`: pasar `cuentaActual?.moneda ?? "MXN"` en el `useMemo` de columnas, agregándolo a las dependencias.
- `PanelConciliacionMovimiento.tsx`: nueva prop `moneda` (default `"MXN"`) usada en el KPI y en el diálogo de ignorar; la pasa la página.
- Tests: caso en `_sections/__tests__` verificando que una cuenta USD renderiza `USD ...` en Cargo/Abono.
- `CHANGELOG.md` + bump de `APP_VERSION` (patch).
