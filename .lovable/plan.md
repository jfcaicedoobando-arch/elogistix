## Objetivo

Cerrar los 2 ítems parciales de la auditoría (B-082 y B-091) y ponerle red de seguridad a los 13 fixes SQL que hoy no tienen ningún test.

## Estado verificado antes del plan

- `fetchPortalNotasCreditoFactura` ya existe y filtra bien (`estado = 'Aplicada'`, `deleted_at IS NULL`), pero **`PortalFacturaPagosCard.tsx` no la consume**: calcula `saldo = totalFactura - totalPagado` y decide "Liquidada" sin restar notas de crédito. Ese es el hueco real de B-082.
- El badge de B-091 en `TarifaCardBadges.tsx` existe pero dice literalmente "Demora día 6", un número quemado que no corresponde cuando la tarifa tiene otros días libres.
- En `supabase/tests/rls/` hay 16 suites, todas de RLS/permisos; ninguna cubre lógica de negocio de las funciones y triggers de tarifas/costeo.

## Parte 1 — B-082: notas de crédito en el saldo del portal

1. En `PortalFacturaPagosCard.tsx`, consumir el hook de NC junto al de pagos y calcular:
   `saldo = max(0, total - pagado - notasCreditoAplicadas)`, con "Liquidada" derivada de ese saldo.
2. Renderizar las NC como una sección propia dentro de la tarjeta (folio, fecha, monto en negativo), separada del historial de pagos para que el cliente vea de dónde sale el descuento.
3. Mostrar una línea de resumen "Total facturado / Pagos / Notas de crédito / Saldo" para que el número cuadre a la vista.
4. Revisar que el listado de facturas del portal y `PortalFacturaDetalle` usen el mismo saldo, no uno propio, para que no queden dos verdades.

## Parte 2 — B-091: copy de demoras

Sustituir el texto quemado por uno derivado de la tarifa: "Demora desde el día N" usando los días libres reales de la fila, y ajustar el tooltip para explicar que el cargo aplica **después** de agotar esos días. Si el dato de días libres no viene, no se muestra el badge en lugar de inventar el día 6.

## Parte 3 — Suite de regresión para los 13 fixes SQL

Nueva suite `supabase/tests/rls/test_reg_costeo_tarifas.sql`, con los mismos helpers (`_helpers.sql`, transacción + ROLLBACK) e integrada al workflow `rls-tests.yml`. Cubre, con aserciones de comportamiento y no de mera existencia del objeto:

- Reemplazo atómico de tarifas: al insertar una tarifa que sustituye a otra, la anterior queda marcada reemplazada y sólo una queda vigente.
- Vista `costeo_tarifas_vigentes_v`: incluye tarifas con vigencia futura, excluye las de agentes inactivos y las vencidas.
- Trigger de estado `vencida` derivado por fecha.
- `get_top_tarifas`: no devuelve filas de otra organización.
- `agente_aprobar_tarifa`: un agente no puede aprobar tarifas fuera de su organización.
- `duplicar_cotizacion` y `actualizar_cotizacion_costos`: corren sin error de columna inexistente (regresión REG B-016 y la de `puerto_origen`).
- `crear_embarque_borrador_core`: hereda la tarifa y no multiplica costos.
- Soft delete (REG B-001): las funciones de listado no devuelven filas con `deleted_at`.
- Policies de storage de cartas garantía: no se lee un objeto de otra organización.

Además, un test unitario de los agregados del portal que verifique que el saldo resta notas de crédito (la parte que no necesita base de datos).

## Notas técnicas

- Todo el trabajo SQL es de pruebas: **ninguna migración nueva**, ningún cambio de esquema.
- Si alguna aserción falla, se reporta como hallazgo y se decide contigo antes de tocar la función — el objetivo de esta ola es la red de seguridad, no reescribir lógica.
- Se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION`.
