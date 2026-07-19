# Revisión Fase M + Plan Fase N

## Revisión Fase M (v13.301.84)

Corrí los guardrails de Fases L y M juntos:

- ✅ **Fase M** (`cerrar-factura-proveedor-rol-fase-m.test.ts`): 5/5 verdes. RPC exige rol, `LC_CERRAR_FACTURA_SIN_ROL` con `ERRCODE 42501`, bitácora con `rol_ejecutor`, `REVOKE/GRANT` correctos.
- ⚠️ **Regresión en Fase L**: 1/5 falló. `cxp-multimoneda-fase-l.test.ts` línea 55 busca `CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo` en "la última migración que contiene `v_proveedor_facturas_saldo`", y la migración de Fase M ahora contiene ese texto (en el `SELECT saldo FROM public.v_proveedor_facturas_saldo`), pero no recrea la vista.

El bug es del test, no del código: `readLatestContaining` usa una substring demasiado permisiva. La vista sigue correcta en la migración de Fase L — la lógica multi-moneda no está rota.

## Fix del guardrail (parte del entregable Fase N)

Cambiar el marker de línea 54 de `"v_proveedor_facturas_saldo"` a `"CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo"` (y análogamente el de `check_no_sobrepago_proveedor` a `"CREATE OR REPLACE FUNCTION public.check_no_sobrepago_proveedor"`) para que apunte a la migración que *define* el objeto, no a cualquiera que lo mencione.

## Plan Fase N — Bugs 21 y 22 (mover recálculo a la BD)

**Analogía**: hoy el semáforo de "Factura Pagada/Vigente" lo pinta el navegador después de registrar el pago. Si dos personas pagan al mismo tiempo, o si alguien llama a la BD desde otro cliente (SQL, script, edge function futura), el semáforo puede quedar en el color equivocado. Vamos a mover ese semáforo al motor de la base de datos, para que sea físicamente imposible que quede desincronizado.

### Bug 22 — Recálculo client-side de estado de factura de proveedor

Actualmente `recalcularEstadoFactura(facturaId)` en `pagosProveedor.ts` hace dos queries + un update tras cada `INSERT/UPDATE` de `pagos_proveedor`. Problemas:
1. No es transaccional: si el cliente muere entre INSERT del pago y UPDATE del estado, la factura queda inconsistente.
2. Cualquier código nuevo que inserte pagos (edge functions, RPCs futuras, scripts) tiene que replicar la lógica.
3. Race conditions bajo concurrencia.

**Fix**: crear trigger `AFTER INSERT/UPDATE/DELETE` en `pagos_proveedor` que recalcule `proveedor_facturas.estado` usando la misma regla (`saldo ≤ 0.01 → Pagada`, respeta `Cancelada`/`Borrador`).

### Bug 21 — Máquina de estado de NC en UI

Las notas de crédito de proveedor (`proveedor_notas_credito`) impactan el saldo vía la vista `v_proveedor_facturas_saldo`, pero el estado de la factura no se recalcula cuando se aplica/cancela una NC — la UI depende de que el usuario vuelva a abrir la factura o que se registre otro pago. Consecuencia: una factura totalmente cubierta por NC puede seguir apareciendo "Vigente" hasta que se ejecute otra acción.

**Fix**: mismo trigger, extendido a `proveedor_notas_credito` — cuando se inserta/actualiza/elimina una NC aplicada a una factura, recalcula el estado de la factura afectada.

### Entregables Fase N (v13.301.85)

1. **Migración** con:
   - `public.tg_recalcular_estado_factura_proveedor()` (SECURITY DEFINER, search_path=public) — lee saldo desde `v_proveedor_facturas_saldo`, respeta `Cancelada`/`Borrador`, usa la misma tolerancia 0.01, hace `UPDATE ... WHERE estado IS DISTINCT FROM nuevo` para evitar loops.
   - Trigger `AFTER INSERT/UPDATE OF monto,monto_en_moneda_factura,deleted_at/DELETE` en `pagos_proveedor`.
   - Trigger `AFTER INSERT/UPDATE/DELETE` en `proveedor_notas_credito` (columnas relevantes: `proveedor_factura_id`, `estado`, `monto`).
   - Backfill: `UPDATE proveedor_facturas SET estado = ...` para reconciliar el universo actual (cubre facturas cuya NC ya las liquidó pero seguían "Vigente").

2. **Cliente**: retirar la llamada a `recalcularEstadoFactura` de `pagosProveedor.ts` (crear/eliminar pago). Mantener `decidirEstadoFactura` como pura para reuso en cálculos de UI, pero marcarla `@deprecated` para escrituras. El servicio ya no ejecuta el UPDATE del estado — confía en el trigger.

3. **Guardrail tests**:
   - `cxp-recalculo-estado-fase-n.test.ts` — asserts sobre la migración: existen ambos triggers, la función respeta `Cancelada`/`Borrador`, usa tolerancia 0.01, GRANT/REVOKE correcto.
   - Fix del test de Fase L (marker estricto para View/Function definitions).

4. **CHANGELOG** con analogía y detalles técnicos.
5. **APP_VERSION** → `13.301.85`.

## Detalles técnicos

- Tratamiento defensivo del backfill: `UPDATE proveedor_facturas pf SET estado = 'Pagada' FROM v_proveedor_facturas_saldo v WHERE v.proveedor_factura_id = pf.id AND pf.estado = 'Vigente' AND v.saldo <= 0.01;` y análogo para el caso inverso (una NC anulada podría reabrir un saldo, pero **no** reabriremos facturas ya Pagadas manualmente si tienen pago real — sólo la trigger fresh maneja transacciones futuras; el backfill sólo mueve `Vigente → Pagada`, nunca al revés, para no sorprender al usuario).
- La trigger es `SECURITY DEFINER` porque `pagos_proveedor` y `proveedor_notas_credito` los inserta el usuario final (RLS activa) pero necesita `UPDATE` sobre `proveedor_facturas` sin depender de la política del usuario que lo disparó.
- No tocaré Fase L: el bug era del test, no de la migración.
