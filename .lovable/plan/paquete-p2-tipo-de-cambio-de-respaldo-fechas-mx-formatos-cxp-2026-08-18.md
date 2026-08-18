# Paquete P2: tipo de cambio de respaldo, fechas MX, formatos CxP y límites de consulta

Verifiqué los 21 archivos de los cuatro paquetes: ninguno de los cambios está aplicado todavía (`formatTipoCambio` no existe, `rutaEstado` sigue usando `setUTCHours`, la delta de conciliación sigue con `toFixed(2)`, y las 5 consultas siguen sin `.limit()`).

## EC-10 — El tipo de cambio de respaldo (17.25) ya no se usa como si fuera oficial

Cuando el servicio de tipos de cambio no responde, la app cae a un valor de respaldo (17.25 USD/MXN). Es útil para ver un tablero, pero es como usar un termómetro de juguete para receta médica: no sirve para valuar deuda ni para timbrar.

- CxP · auto-llenado de T/C DOF en factura de proveedor: rechaza el valor de respaldo y pide captura manual, en lugar de mostrar "T/C DOF" con éxito.
- Facturación · Registrar pago (timbra REP): si hay conversión entre monedas y el T/C es de respaldo, se bloquea el envío y se muestra la alerta "Tipo de cambio de respaldo".
- Profit · Estado de Resultados devengado: se agrega el banner `TipoCambioFallbackBanner`.
- Embarques · paso Costos y Precios: `StepCostosTcAviso` avisa cuando el T/C precargado es de respaldo.

## EC-06 — Fechas "solo día" ya no se corren un día en México

`new Date("2026-06-01")` se interpreta como medianoche UTC, que en CDMX es la tarde del día anterior. Se corrigen 5 casos usando el patrón local ya existente (`hoyMx`, `parseLocalMx`):

1. Aviso de tarifa vencida antes de la validez (cotización).
2. `diasHasta()` en el estado de rutas de costeo.
3. Celda de vigencia en el listado de cotizaciones (comparación por texto ISO).
4. `validez_propuesta` al mapear el formulario de cotización.
5. `vigenciaPlus30()` en el detalle de proformas.

## UX-12 — Moneda y T/C con formato canónico en CxP

- La delta de conciliación pasa de `Δ $1234567.89` a moneda formateada con miles y código.
- Los tipos de cambio se muestran con `formatTipoCambio` (4 decimales, como publica el DOF) en eliminar factura, banda de contexto de factura y pago a proveedor.
- La gráfica de antigüedad de compras usa el formateador compartido en vez de crear su propio `Intl.NumberFormat`.

## EC-05 — Límites defensivos en 5 consultas

Se agregan `.limit()` + `assertNotTruncated` (patrón ya usado en bandejas) a: eventos de tracking del panel de operador, embarques por cliente para expedientes, catálogo de organizaciones (admin), comentarios de auditoría y costos de cotización. Así, si algún día el resultado se corta, la app avisa en vez de mostrar datos incompletos en silencio.

## Detalles técnicos

- Se aplican los cuatro diffs de los archivos subidos con `patch -p1`, revisando manualmente cualquier hunk rechazado.
- `formatTipoCambio` se agrega a `src/lib/formatters/numbers.ts` (4 decimales) y se reexporta desde `@/lib/formatters`.
- Cierre: `bunx tsgo --noEmit`, suites de arquitectura y de formatters/fechas, entrada en `CHANGELOG.md` y bump de `APP_VERSION` a 13.657.0.
