# Bloquear cobros cuando la factura está "en cancelación"

## Problema

Cuando se solicita la cancelación de un CFDI ante el SAT, la factura queda en trámite (`cancellation_status` = `pending` / `verifying`) pero su estado sigue siendo *Emitida* / *Vencida* / *Parcialmente pagada*. Hoy:

- El botón **Registrar pago** sigue visible (`puedeRegistrarPago` en `facturaFlags.ts` sólo mira el estado, no el trámite de cancelación).
- La guardia de base de datos `assert_factura_viva_para_pago` sólo rechaza `Cancelada`, `Sustituida` y `Borrador`.
- El **cobro en lote** (`registrar_pago_cliente_lote`) tampoco revisa el trámite.

Resultado: se puede cobrar y timbrar un REP de una factura que está a punto de desaparecer fiscalmente.

## Qué se va a hacer

1. **Candado en base de datos (fuente de verdad)**
   - Extender `assert_factura_viva_para_pago` para rechazar el pago cuando la factura tenga `cancellation_status` en (`pending`, `verifying`), con error claro `LC_FACTURA_EN_CANCELACION`.
   - Aplicar la misma validación dentro de `registrar_pago_cliente_lote`, para que el renglón afectado detenga el lote con el mismo mensaje (mismo criterio que las demás guardas del lote).

2. **Interfaz (evitar el clic muerto)**
   - En `facturaFlags.ts`, `puedeRegistrarPago` pasa a exigir que no haya trámite de cancelación en curso (reutilizando el helper `enTramiteCancelacion` que ya existe).
   - En el detalle de factura, mostrar la razón: badge/aviso "Cancelación en trámite ante el SAT: no se pueden registrar cobros".
   - En la bandeja Por cobrar / Cartera, excluir de la selección de cobro en lote las facturas en trámite de cancelación (o marcarlas como no seleccionables con tooltip).

3. **Traducción de error**
   - Registrar `LC_FACTURA_EN_CANCELACION` en el catálogo de mensajes `LC_*` para que si el candado se dispara, el usuario lea español claro.

4. **Pruebas y cierre**
   - Test unitario de `deriveFacturaFlags`: `pending`/`verifying` ⇒ `puedeRegistrarPago = false`; `none`/`rejected` ⇒ se mantiene el comportamiento actual.
   - Prueba SQL de regresión: insertar pago sobre factura en `verifying` debe fallar.
   - Actualizar `CHANGELOG.md` y `APP_VERSION`.

## Notas técnicas

- Si el SAT **rechaza** la cancelación (`cancellation_status` distinto de pending/verifying y estado sigue Emitida), la factura vuelve a ser cobrable automáticamente; no se requiere acción manual.
- No se toca ningún pago ya registrado: el candado aplica sólo a inserciones nuevas.
- Cambio de esquema vía migración nueva + sincronización de los archivos canónicos en `supabase/schema/`.
