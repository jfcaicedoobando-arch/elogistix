## Fase R.8 — Fixes de auditoría ronda 5

Aplicar el paquete de 3 migraciones que subiste (REG-1, REG-2, N-3), verificar y bumpear versión.

### 1. Migración `fix_reg1_revalidacion_deadlock` (showstopper)

Reescribir la guarda de revalidación de tarifa para desbloquear el flujo cotización→embarque:

- `enforce_revalidacion_sin_cambios(uuid)`: solo lanza en severidad `bloqueante`; corto-circuito si `estado_revalidacion='reaprobada'`. `informativa` deja pasar.
- Extraer el cuerpo del 1-arg a `crear_embarque_borrador_core(uuid)` (privado, solo `service_role`).
- 1-arg público = guarda + core (vía directa).
- 4-arg con `p_decision`: cuando la decisión es explícita (`refrescada` / `mantenida_por_operaciones` / `sustituida` / `reaprobada_ventas`) **es** la resolución: convierte, registra `tarifa_decision` + tarifa aplicada + delta, y marca la cotización `reaprobada` si estaba `pendiente_reaprobacion`. Registra bitácora `tarifa_decision_aplicada`.

Efecto: los 4 valores de decisión dejan de ser código muerto y los drifts `informativa` ya no bloquean.

### 2. Migración `fix_reg2_cxc_monto_convertido`

Blindar `pagos_factura.monto_aplicado_factura` en BD (espejo del patrón de Fase L en CxP):

- Trigger `BEFORE INSERT OR UPDATE OF monto/moneda/tipo_cambio/factura_id` que recalcula vía `convertir_monto_pago_a_factura`, tratando `tipo_cambio=1` en cruce de monedas como placeholder ausente.
- Backfill defensivo de pagos con cruce de monedas (por fila con `EXCEPTION WHEN OTHERS`; los que no tengan TC caen a WARNING para revisión manual).

Efecto: cierra el bypass de sobrepago vía API directa y arregla saldos multi-moneda que consumen `saldo_factura()` y `assert_factura_viva_para_pago`.

### 3. Migración `fix_n3_comisiones_factura_cancelada`

Trigger `AFTER UPDATE OF estado` en `facturas`:

- Cuando la factura pasa a `Cancelada` o `Sustituida`, marca sus `comisiones_devengadas` con estado `Devengada` como `Cancelada` y agrega nota `[auto] factura Cancelada/Sustituida (núm. XXX)`.
- Las `Liquidada` no se tocan (ese dinero ya se pagó al vendedor).

Efecto: no quedan comisiones vivas sobre CFDIs muertos.

### 4. Verificación y cierre

- Correr `bun run ci:fast` para confirmar que lint/typecheck/vitest siguen verdes (los servicios cliente ya toleran los cambios; no requieren edición en este paquete).
- Bump `APP_VERSION` → `13.301.99`.
- Actualizar `CHANGELOG.md` con la entrada de Fase R.8 (los 3 fixes + qué desbloquean).

### Fuera de alcance (backlog explícito del documento)

- Residual Fase B (`revertir_proforma_al_cancelar_sustitucion` excluyendo `'Borrador'`) — nota: ya lo cerramos en R.7 vía guardrail `revertir-proforma-borrador-vivo.test.ts`; lo verifico y si aplica lo confirmo en el changelog, sin nueva migración.
- N-1 conciliación movimiento↔pago, N-2 anticipos de clientes, N-4 pre-check local de REPs vivos.

### Detalles técnicos

Se emite una sola migración con los 3 bloques SQL en orden (REG-1 → REG-2 → N-3). Todo idempotente (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`). Los `GRANT`/`REVOKE` sobre las nuevas funciones se aplican en el mismo bloque. El backfill de REG-2 corre en un `DO $$` con conteo `NOTICE` para trazabilidad.
