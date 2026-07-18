## Contexto verificado

Confirmé contra la base de datos y el código:

- `validar_cierre_embarque` (regla 6) y `recalcular_cobro_embarques` filtran por `estado <> 'Cancelada'` — incluyen `Sustituida` y `Borrador`, y **no restan NCs aplicadas**. ✅ BUG 6 real.
- Existen facturas `estado='Sustituida'` en producción (ej. bd75aa84…) → doble conteo posible al cerrar embarques con sustitución. ✅
- `fetchEmbarqueDependenciasFinancieras` no cuenta proformas; `eliminar_embarque_completo` no soft-borra proformas, pagos ni comisiones. ✅ BUG 7 real.
- Actualmente **no hay pagos con REP `Timbrado` activos** (0 filas), así que BUG 8 no ha dañado datos, pero la guarda debe existir antes de que aparezca el primero.
- `recalcular_estado_factura`, `check_factura_saldo_para_nc` y `avanzar_estado_embarque` existen tal cual los describe la auditoría (pendiente leer definición completa para las fases 9-12, pero el planteamiento coincide con lo que ya audité en rondas previas).

Los hallazgos 6, 7, 8 tocan **dinero, fiscal y borrado**: van primero. 9-12 son consistencia y grafo de estados: van después. Los "menores" quedan como cleanup opcional.

## Fase D — v13.301.73: Fijar la definición de "factura viva" en cierre y cobranza (BUG 6, BUG 9)

Objetivo: que las reglas de cierre y el estado de factura usen la **misma** definición de saldo que el resto de la app.

1. Nueva función SQL `public.saldo_factura(uuid) RETURNS numeric` — devuelve `total - pagos_no_borrados - ncs_aplicadas_no_borradas`, ignorando facturas `Cancelada`/`Sustituida`/`Borrador`. Fuente única.
2. `validar_cierre_embarque` y `cerrar_embarque` regla 6:
   - Reemplazar el par `v_cxc_total / v_cxc_pagado` por `SUM(saldo_factura(id))` sobre facturas del embarque con `estado IN (SELECT unnest(FACTURA_ESTADOS_VIVOS))` **y** `cancellation_status IS NULL`.
   - Regla ok cuando `SUM(saldo) <= 0.01`.
3. `recalcular_cobro_embarques` (y el trigger de `cobro_cliente_status`): mismo filtro de "viva" + resta de NCs.
4. `recalcular_estado_factura` (trigger de `pagos_factura`): añadir dependencia de `factura_notas_credito` — si `saldo_factura(id) <= 0.01` marcar `Pagada`, en vez de solo comparar contra suma de pagos. Trigger espejo en `factura_notas_credito` para recalcular al aplicar/cancelar una NC.
5. Guardrails Vitest:
   - `cierre-nc-resta-saldo.test.ts`: SQL de la migración contiene `saldo_factura` en regla `cxc_cobrada`.
   - `factura-viva-excluye-sustituida-borrador.test.ts`: las funciones no aceptan `Sustituida`, `Borrador`, `Cancelada`.
6. **Backfill idempotente**: recorrer facturas cubiertas por NC al 100% y recalcular `estado` (hoy quedan como "Parcialmente pagada" falsas).

## Fase E — v13.301.74: Blindar borrado de embarque (BUG 7)

Objetivo: que "Eliminar embarque" no deje huérfanos vivos y respete facturas emitidas.

1. Ampliar `fetchEmbarqueDependenciasFinancieras` para incluir **proformas** `estado IN ('Aceptada','Enviada','Borrador')` como bloqueante suave (permite borrar solo con confirmación extra) y **comisiones devengadas**.
2. `eliminar_embarque_completo`:
   - `RAISE` si existe cualquier factura viva (`Emitida`, `Pagada`, `Parcial`) — hoy solo confía en la UI.
   - Soft-borrar `proformas`, `pagos_factura`, `proveedor_facturas`, `comisiones_devengadas` del embarque en la misma transacción.
   - Registrar en `bitacora_actividad` el conteo por tabla.
3. `convertir_proformas_a_factura`: validar `embarque.deleted_at IS NULL` antes de emitir.
4. Guardrail: `eliminar-embarque-bloquea-facturas-vivas.test.ts` y `convertir-proforma-embarque-vivo.test.ts`.

## Fase F — v13.301.75: Candados de pagos y REP (BUG 8, BUG 10, BUG 11)

1. **BUG 8**: `eliminarPagoFactura` (service) y trigger `pagos_factura BEFORE DELETE/UPDATE deleted_at` — bloquear si `estado_rep IN ('Timbrado','En cancelación')`. Botón "Eliminar" en `FacturaPagosSection` con `disabled` + tooltip "Cancela primero el REP en el SAT".
2. **BUG 10**: trigger `check_no_sobrepago_factura` espejo del que ya existe en CxP — `RAISE` si `SUM(monto_aplicado_factura) > factura.total + 0.01`.
3. **BUG 11**: `check_factura_saldo_para_nc`:
   - Filtrar `deleted_at IS NULL` al sumar NCs `Aplicada`.
   - Aplicar la validación a `estado IN ('Emitida','Pagada','Parcialmente pagada','Vencida')`, no solo `Emitida`.
4. Guardrails: `rep-timbrado-bloquea-borrado-pago.test.ts`, `sobrepago-cxc-bloqueado.test.ts`, `nc-saldo-check-ignora-borradas.test.ts`.

## Fase G — v13.301.76: Grafo de transiciones de embarque (BUG 12)

1. Tabla constante `ESTADO_EMBARQUE_TRANSICIONES` en SQL (grafo dirigido). `avanzar_estado_embarque` valida que `(estado_actual, nuevo_estado)` pertenezca al grafo o `RAISE`.
2. Permitir retroceso solo con motivo obligatorio (≥20 chars) y solo hasta el estado anterior — mismo patrón que reapertura de cierre.
3. UI (`useEmbarqueEstadoActions`): mostrar solo estados válidos en el `Select` según el estado actual.
4. Guardrail: `transiciones-embarque-grafo.test.ts` (recorre pares y valida).

## Fuera de alcance (para una fase G+ si lo apruebas después)

- Menores: revertir comisiones al cancelar factura timbrada, cotización tras eliminar embarque, comisión sobre factura real vs. conceptos.
- Cada uno cabe en una fase corta propia; no los mezclo aquí para no volver la migración una bola.

## Orden y por qué

D → E → F → G. Cada fase queda **verde antes de la siguiente** (mismo patrón de rondas anteriores: migración + guardrail + backfill idempotente + CHANGELOG + bump). Empezamos por D porque desbloquea cierres reales hoy (`Sustituida` en producción) y arregla el estado de factura que alimenta todos los reportes financieros ya blindados en `v13.301.62`.

## Riesgos

- **Riesgo D**: cambiar la definición de "Pagada" recalcula estados masivamente. Mitigación: backfill en misma migración, contando antes/después, con bitácora.
- **Riesgo E**: bloquear borrado con facturas vivas puede molestar a quien limpia data de pruebas. Mitigación: super_admin sigue con RPC directa; el bloqueo es en la RPC pública.
- **Riesgo G**: rutas de negocio actualmente en producción podrían tener saltos raros históricos. Mitigación: el grafo permite el conjunto observado en `bitacora_actividad` (query previo a la migración), no un ideal teórico.
