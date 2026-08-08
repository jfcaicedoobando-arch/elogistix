# Drill-down directo: movimiento bancario → detalle del pago

## Situación actual (verificada)

- En **Conciliación bancaria** (`/tesoreria/conciliacion`) el detalle del pago sólo se abre en dos pasos: hay que hacer clic en el renglón, y luego usar el botón "Ver detalle del pago" del panel derecho.
- En la tabla de movimientos (`movimientoColumns.tsx`) no existe ninguna acción por renglón: sus columnas son Fecha, Concepto, Cargo, Abono, Estado.
- En **Estado de cuenta** (`/tesoreria/estado-cuenta`) los movimientos no tienen ningún acceso al pago, aunque los datos de vínculo (`pago_factura_id`, `pago_proveedor_id`, `pago_proveedor_lote_id`, `anticipo_proveedor_id`) ya vienen cargados en ambas pantallas.
- Ya existe todo lo necesario para mostrar el detalle: `DetallePagoSheet`, la RPC `pago_detalle` y el resolvedor `refPagoDeMovimiento`.

## Qué se va a construir

1. **Acción por renglón en Conciliación**: nueva columna de acción al final de la tabla con un botón "Ver pago" que aparece sólo cuando el movimiento está conciliado y tiene un pago vinculado. Un clic abre directamente el detalle del pago con sus facturas aplicadas, sin pasar por el panel lateral.
2. **Mismo acceso en Estado de cuenta**: botón equivalente en cada renglón conciliado del extracto, para poder auditar el extracto sin cambiar de pantalla.
3. **Indicador visual**: los movimientos conciliados con pago vinculado muestran una señal discreta (ícono/badge) para distinguirlos de los conciliados sin vínculo (movimientos antiguos), evitando botones que no llevan a nada.
4. **Panel lateral intacto**: el botón actual del panel se mantiene, ahora como camino alternativo.
5. **Continuidad del drill-down**: desde el detalle del pago se sigue navegando a cada factura aplicada (rutas ya existentes de facturación y compras).

## Detalles técnicos

- `src/features/tesoreria/routes/_sections/movimientoColumns.tsx`: pasa de constante a factory `crearMovimientoColumns(onVerPago)` para inyectar el callback; la celda usa `refPagoDeMovimiento(mov)` y `e.stopPropagation()` para no disparar la selección del renglón.
- `TesoreriaConciliacion.tsx`: estado local `refPagoAbierto: RefPago | null` y render de `DetallePagoSheet` a nivel de página (memoizando columnas con `useMemo`).
- `TesoreriaEstadoCuenta.tsx` + su tabla de movimientos: misma columna de acción reutilizando `refPagoDeMovimiento` sobre `MovimientoEstadoCuenta`.
- Sin cambios de base de datos: `pago_detalle` y las columnas de vínculo ya existen.
- Tests: casos nuevos en el dominio para la lógica de "mostrar botón" (conciliado + vínculo) y verificación visual en FullHD.
- Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION`.
