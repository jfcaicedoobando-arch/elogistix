# Fase S — Cierre del backlog de Auditoría Profunda

Retomo los 4 pendientes que quedaron documentados en el CHANGELOG (líneas 529 y 543) como "fuera de alcance" de las Fases R.1–R.7. Cada sub-fase es **1 migración + servicio TS + UI mínima + tests**, sin cambios visuales fuera del contexto de cada bug.

## Fase S.1 — N-1: guards de vínculo `bbva_movimientos` ↔ pagos

**Bug**: hoy se pueden vincular pagos a movimientos bancarios sin ninguna validación de que el movimiento pertenezca a la misma organización, que la divisa cuadre, o que un movimiento ya haya sido consumido por otro pago (doble aplicación silenciosa).

**Fix**:
- **BD**: función `assert_movimiento_pago_consistente()` + trigger `BEFORE INSERT OR UPDATE OF bbva_movimiento_id` en `pagos_factura` y `pagos_proveedor`. Valida:
  1. `movimiento.organization_id = pago.organization_id`.
  2. `movimiento.moneda = pago.moneda` (o conversión explícita registrada).
  3. Un movimiento no puede estar vinculado a >1 pago vivo (índice único parcial `WHERE deleted_at IS NULL AND bbva_movimiento_id IS NOT NULL`).
- **Servicio**: nuevas clases `MovimientoOrgMismatchError`, `MovimientoDivisaMismatchError`, `MovimientoYaVinculadoError`.
- **UI**: en el selector de movimientos (`SelectorMovimientoBanco`) filtrar por org y moneda; tooltip cuando el movimiento ya está vinculado.
- **Tests**: `pagos.test.ts` + `pagosProveedor.test.ts` — 3 casos por servicio.

## Fase S.2 — N-2: saldo a favor de anticipos de clientes

**Bug**: los anticipos de clientes (`anticipos_aplicaciones` / `pagos_factura` con `es_anticipo=true`) generan saldo a favor cuando el pago > total facturado, pero no hay flujo para aplicarlo a facturas futuras: el saldo queda "flotando" en la cuenta del cliente sin trazabilidad.

**Fix**:
- **BD**: vista `v_saldo_favor_cliente(cliente_id, moneda, saldo_disponible)` que agrega anticipos vivos menos aplicaciones. Función `aplicar_saldo_favor_a_factura(p_factura_id, p_monto)` (`SECURITY DEFINER`) que:
  1. Valida que la factura no esté cancelada/sustituida.
  2. Consume del saldo disponible del cliente (FIFO por fecha de anticipo).
  3. Genera pagos `origen='saldo_favor'` con `anticipo_origen_id` para trazabilidad.
- **Servicio**: `aplicarSaldoFavor(facturaId, monto)` + hook `useAplicarSaldoFavor` + query `useSaldoFavorCliente(clienteId, moneda)`.
- **UI**: en el header de detalle de factura, banner "Cliente tiene $X de saldo a favor · Aplicar" cuando `saldo_disponible > 0`.
- **Tests**: `saldoFavor.test.ts` — happy path, factura cancelada, saldo insuficiente, FIFO order.

## Fase S.3 — N-4: pre-check local de REPs vivos antes de cancelar factura

**Bug**: al cancelar una factura con REPs (Recibos Electrónicos de Pago) vivos, la BD ya lanza `LC_FACTURA_CON_REP_VIVO` (guarda existente de la Fase R), pero la UI muestra un error rojo genérico después del roundtrip. El usuario no sabe cuántos REPs debe cancelar primero.

**Fix**:
- **Servicio**: en `cancelarFactura` hacer pre-check `SELECT COUNT(*) FROM pagos_factura WHERE factura_id = $1 AND uuid_rep IS NOT NULL AND rep_cancelado_en IS NULL AND deleted_at IS NULL`. Si `> 0`, lanzar `FacturaConRepsVivosError` con `cantidad` sin roundtrip.
- **UI**: el botón "Cancelar factura" muestra badge `N REPs vivos` cuando aplica, y al abrir el modal de cancelación aparece checklist de REPs pendientes con link a la sección REP. El submit queda deshabilitado hasta 0.
- **BD**: sin cambios (la guarda ya existe).
- **Tests**: `facturas.cancelar.test.ts` — 2 casos (0 REPs vivos, 3 REPs vivos).

## Fase S.4 — R.7-deuda: prohibir firma corta de conversión cotización→embarque

**Bug**: el RPC `crear_embarque_borrador_desde_cotizacion(uuid)` (1-arg) sigue existiendo y sigue siendo llamado por `useCrearEmbarqueBorrador`. Después de R.6 ya no salta la revalidación (la BD la fuerza), pero los llamadores TS no reciben metadatos de decisión de tarifa — el flujo queda "invisible" para observabilidad.

**Fix**:
- **TS types**: marcar la firma 1-arg como `@deprecated` en `types.ts` (auto-gen no, pero sí en un wrapper en `services/conversiones/embarques.ts`).
- **Servicio**: `crearEmbarqueBorradorDesdeCotizacion` exige ahora `{ cotizacionId, decision, tarifaAplicada?, delta? }` — si `decision='sin_cambios'` internamente llama 1-arg; si otra, llama 4-arg. Los llamadores pasan siempre por este wrapper.
- **UI**: `useCotizacionDetalleHandlers.handleCrearBorrador` pasa siempre por `RevalidarTarifaModal` cuando la revalidación devuelve severidad ≠ `sin_cambios`; el flujo actual ya lo hace tras R.6, sólo se remueve el catch fallback.
- **BD**: opcional — `REVOKE EXECUTE` del 1-arg al role `authenticated` y dejar sólo `service_role` (defensa en profundidad).
- **Tests**: `conversiones.embarques.test.ts` — firma nueva, error si falta `decision`, delegación correcta al 1/4-arg.

## Entregables

- 3 migraciones nuevas (S.1, S.2, S.4).
- 4–6 servicios/hooks nuevos.
- Ajustes UI puntuales (banner saldo a favor, badge REPs vivos, tooltip movimiento vinculado).
- ~12 tests unitarios nuevos.
- CHANGELOG: 4 entries `[13.303.77]` a `[13.303.80]`, uno por sub-fase.
- Bump final `APP_VERSION → 13.303.80`.

## Notas de riesgo

- **S.1** rompe cualquier vínculo ya duplicado en producción — la migración incluye una consulta de sanity `SELECT bbva_movimiento_id, COUNT(*) FROM pagos_factura WHERE deleted_at IS NULL AND bbva_movimiento_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1` que sólo reporta; el índice único parcial se crea `NOT VALID` inicialmente si hay filas ofensoras.
- **S.2** el FIFO de anticipos asume `anticipos_proveedor.fecha_registro` como orden estable; hay que confirmar la columna real de anticipos de **cliente**.
- **S.4** puede romper llamadores externos (webhooks, scripts) — se mantiene el 1-arg en BD, sólo se cierra a nivel TS.

## Orden de commits

1. `S.1` (independiente, más aislado).
2. `S.2` (necesita vista + RPC, mayor cirugía).
3. `S.3` (sólo cliente, menos riesgo).
4. `S.4` (cambio de firma, mayor blast radius si se hace mal).
