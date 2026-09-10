# Factura 1015 sigue "Pagada" aunque el pago quedó anulado

## Qué encontré

La factura 1015 (17,910.00 USD) tiene un solo pago, y ese pago ya está anulado porque su REP se canceló ante el SAT. Aun así la factura sigue marcada como **Pagada**.

La causa es un círculo vicioso en el cálculo del saldo: el saldo de una factura devuelve cero cuando la factura ya está marcada como "Pagada" (atajo que se puso para facturas antiguas sin pagos capturados). El recálculo de estado usa justamente ese saldo, así que ve cero, concluye "Pagada" y nunca la saca de ese estado. Es como preguntarle a alguien "¿ya pagaste?" y que responda "sí, porque dice pagado en mi recibo".

Confirmado en la base: hay **21 facturas** en esta misma situación (1015, 1016, 1017, 1018, 1019, 1020, 1022, 1023, 1024, 1028, 1029, 1030, 1031, 1036, 1041, 1042, 1043, 1044, 1045, 1046, 1048), todas con su único pago anulado y todas todavía "Pagada". Su última actualización de estado es del 08/09, anterior al ajuste de pagos anulados, y el pago se marcó cancelado el 10/09 sin que el estado se moviera.

## Qué haré

1. Corregir el recálculo de estado para que use el saldo **sin** el atajo de "Pagada", de modo que una factura pueda regresar a Emitida o Vencida cuando su único pago queda anulado.
2. Volver a calcular el estado de las 21 facturas afectadas. Quedarán en Emitida o Vencida según su fecha de vencimiento, y volverán a aparecer en cartera y antigüedad de saldos con el monto correcto.
3. No se toca nada más: importes, IVA, comprobantes, REPs, pagos (siguen visibles como "Anulado"), comisiones ni movimientos de banco.
4. Registrar el cambio en la bitácora, actualizar el historial de versiones y subir la versión de la aplicación.

## Detalles técnicos

- `public.recalcular_estado_factura()` pasará a calcular `v_saldo` con `public.saldo_factura_bruto(v_factura_id)` en lugar de `public.saldo_factura(...)`. `saldo_factura_bruto` ya excluye pagos con `estado_rep = 'Cancelado'` y aplica notas de crédito, y no corta en seco cuando el estado es `Pagada`. El early-return de `Cancelada / Borrador / Sustituida` se conserva, igual que el `set_config('app.recalc_estado_factura','1', true)` que autoriza a `guard_estado_factura`.
- Se deja intacto `saldo_factura` (portal, cartera, aging, Dirección) para no alterar el comportamiento de facturas legacy sin pagos.
- Migración de datos: disparar el recálculo por las 21 facturas con `estado_rep = 'Cancelado'` y estado `Pagada`, dentro de una función/bloque con el flag de recálculo, y dejar traza en `bitacora_actividad`.
- Espejos: reflejar la nueva definición en `supabase/schema/baseline.sql` (y el archivo canónico correspondiente en `supabase/schema/` si existe para esta función), más `bun run db:release-manifest:update`.
- Pruebas focalizadas de facturación + typecheck y lint focalizado; CI, RLS y E2E completos quedan para GitHub Actions.
