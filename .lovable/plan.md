# Verificación auditoría R4 — estado real vs. reporte

Revisé cada finding contra la base de datos en vivo (definiciones actuales de funciones, triggers, vistas y columnas). Marcado: ✅ ya no existe · ⚠️ parcial · ❌ sigue vigente.

## BLOQUE A — P0

**FIX-R4-01 · Triggers de recálculo de estado de factura** — ✅ EXISTEN
`trg_recalcular_estado_factura` (pagos_factura) y `trg_recalcular_estado_factura_nc` (factura_notas_credito) están vivos y ejecutan `recalcular_estado_factura()`, que suma NCs 'Aplicada' y setea el estado. El bug reportado (triggers destruidos por CASCADE) no aplica hoy.

**FIX-R4-02 · `convertir_proformas_a_factura` inutilizable** — ✅ CORREGIDO
Firma real: `(uuid[], uuid, text, text, text, int, text, uuid)`. Gate único vía `es_escritor_financiero()` (que incluye admin, admin_org, contador, tesorero, ejecutivo_cobranza y super_admin). Bitácora usa columnas correctas (`usuario_id`, `modulo`, `entidad_nombre`, `detalles`). Conceptos MXN/USD se insertan con IVA y clave SAT; se generan facturas separadas por moneda. Idempotencia con `LC_PROFORMA_YA_FACTURADA` y `LC_PROFORMA_SIN_PERMISO`.

## BLOQUE B — P1

**FIX-R4-03 · Margen mínimo de cierre inerte** — ✅ CORREGIDO
`validar_cierre_embarque` lee `v_pnl->>'venta_mxn'` y `utilidad_mxn`, calcula `margen_pct` como porcentaje y compara contra `pnl_margen_minimo_cierre`. La regla ya bloquea.

**FIX-R4-04 · TOCTOU sobrepago CxC** — ❌ SIGUE VIGENTE
`tg_pago_factura_no_sobrepago` NO hace `SELECT ... FOR UPDATE` sobre la factura antes de validar `saldo_factura()`. Dos pagos concurrentes por el saldo total pueden pasar ambos. (El de CxP sí lo hace.)

**FIX-R4-05 · Retenciones no se prorratean** — ⚠️ PARCIAL
El trigger sigue llamándose `trg_pagos_factura_calc_ret` (alfabéticamente ANTES de `trg_pagos_factura_monto_convertido`) y el código usa `NEW.monto_aplicado_factura` sin `COALESCE(..., NEW.monto)`. En INSERT donde `monto_aplicado_factura` no se envíe explícitamente, el prorrateo queda en 0. No aplicado ni el rename `zz_*` ni el fallback.

**FIX-R4-06 · Fallback silencioso a TC de la factura** — ❌ SIGUE VIGENTE
`convertir_monto_pago_a_factura` conserva `v_tc := COALESCE(NULLIF(p_tc_pago,0), NULLIF(p_tc_fact,0))`. Si el pago no trae TC pero la factura sí, usa el de la factura sin marcar `LC_PAGO_TC_REQUERIDO`.

**FIX-R4-07 · `embarque_estado_financiero**` — ✅ (vista removida)
La vista ya no existe en la BD, así que el bug reportado ya no aplica. (Si el frontend todavía la consulta, sería un bug distinto — puedo revisarlo si me lo pides.)

**FIX-R4-08 · Sobrecargas ambiguas** — ⚠️ PARCIAL
Solo queda ambigüedad en `generar_expediente`: existen dos firmas `(text)` y `(tipo_operacion)`. Las otras dos (`crear_embarque_borrador_desde_cotizacion`, `actualizar_embarque_completo`) ya tienen una única firma.

**FIX-R4-09 · `folio_secuencias` sin backfill** — ⚠️ ESQUEMA DIVERGENTE
La tabla real tiene `(organization_id, tipo, ultimo_numero, updated_at)` — no `valor`. El generador `siguiente_folio_cotizacion` usa un tipo por año (`cotizacion_2026`) y ON CONFLICT, así que dentro del año está bien. Falta backfill para orgs con folios preexistentes migrados desde otros sistemas.

**FIX-R4-10 · Guards fail-open y GUC bypass**

- (a) `saldo_factura` y `validar_cierre_embarque` mantienen `IF v_caller_org IS NOT NULL AND ...` (fail-open cuando no hay caller). Es intencional para service_role/tests, pero un usuario auth **sin membresía** tiene `current_user_org_id()=NULL` y bypasea el guard. ❌ VIGENTE.
- (b) `marcar_facturas_vencidas()` NO filtra por `organization_id`; corre global y `set_config('app.recalc_estado_factura','1')` es seteable por cualquiera. ❌ VIGENTE.
- (c) `_recalc_estado_proveedor_factura(uuid)` existe; no verifiqué su REVOKE — probable ❌.

## BLOQUE C — P2

**FIX-R4-11 · Guard REP incompleto** — ❌ VIGENTE
`assert_pago_sin_rep_vivo_delete` sigue chequeando solo `estado_rep = 'Timbrado'`; REP 'Pendiente' pasa el DELETE.

**FIX-R4-12 · `pagos_factura.tipo_cambio` DEFAULT 1 NOT NULL** — ❌ VIGENTE
Confirmado en `information_schema`. `calcular_comision_pago` sigue vulnerable al cortocircuito.

**FIX-R4-13 · Signup crea org basura + rol global `admin_org**` — ❌ VIGENTE
`handle_new_user_signup` sigue insertando organización "Mi organización" y `user_roles` con `admin_org` cuando `skip_auto_org != true`.

**FIX-R4-14 · Migraciones frágiles** — no verificable en runtime (requiere fresh install). Los CI stubs añadidos en v13.307.24 (cron.job, cron.unschedule) mitigan el 20260722132715.

**FIX-R4-15 · Menores**

1. `crear_proforma_atomica` MXN=0 para conceptos USD — no verificado.
2. Duplicados en `pagos_proveedor`: ❌ confirmado. Coexisten `pagos_proveedor_requiere_aprobacion` + `trg_pago_requiere_aprobacion`, y `trg_check_no_sobrepago` + `tg_pagos_proveedor_no_sobrepago`.
3. ERRCODEs de proforma: ✅ `LC_PROFORMA_YA_FACTURADA` y `LC_PROFORMA_SIN_PERMISO` presentes (aunque `_YA_FACTURADA` no lleva ERRCODE explícito, solo el prefijo del mensaje).
4. Oráculo de existencia en `soft_delete_pago_*`: no verificado a fondo.
5. Escala de decimales en pagos: no verificado.

## Resumen ejecutable

**Sigue vigente y accionable (P0/P1):**

- R4-04 (TOCTOU CxC), R4-05 (orden triggers retenciones), R4-06 (fallback TC), R4-08 (`generar_expediente` ambiguo), R4-10a/b/c (fail-open + `marcar_facturas_vencidas` sin filtro org + REVOKE).

**Sigue vigente (P2):**

- R4-11 (REP Pendiente), R4-12 (TC default 1), R4-13 (signup crea org), R4-15.2 (triggers duplicados pagos_proveedor).

**Ya corregido / no aplica:**

- R4-01, R4-02, R4-03, R4-07.

**Parcial / a completar:**

- R4-09 (backfill por org si aplica migraciones desde legacy).

## Siguiente paso

Si apruebas, arranco una remediación en dos migraciones nuevas (`fix_r4_bloque_ab` y `fix_r4_bloque_c`) que aborda los bugs vigentes en el orden A→B→C listado arriba, con pruebas de aceptación por cada uno. ¿Quieres que proceda con toda la remediación o solo con el subconjunto P0/P1? procede con todo