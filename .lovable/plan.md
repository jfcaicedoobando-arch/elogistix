
# Plan — Auditoría R3: correcciones P0/P1/P2

Aplicar los 20 fixes del documento `instrucciones-lovable-r3.md` en 3 bloques ordenados. Todos los cambios de BD van en migraciones **nuevas** e idempotentes (`20260722XXXXXX_fix_r3_*.sql`), sin editar migraciones ya aplicadas. Cambios de UI/servicios sólo donde el fix lo requiera explícitamente.

## Bloque A — P0 (regresiones que rompen flujos principales)

1. **R3-01 · Recálculo de estados de factura** — Migración que re-declara `recalcular_estado_factura()` y recrea 3 triggers (`trg_recalcular_estado_factura` en `pagos_factura` y `factura_notas_credito`, `trg_pagos_factura_calc_ret`). Deja marca de sesión `app.recalc_estado_factura=1` para pasar el guard. Repara el orden de columnas de `facturacion_por_emitir` / `embarque_estado_financiero` que falla en fresh install.
2. **R3-02 · Pagos CxP sin TC** — DROP DEFAULT de `pagos_proveedor.tipo_cambio_usd`, sustituir CHECK físico por `tipo_cambio_usd IS NULL OR > 0`. Mover la validación de negocio al trigger de conversión, emitiendo `LC_PAGO_TC_REQUERIDO` sólo cuando la moneda del pago difiere de la moneda de la factura.
3. **R3-03 · CHECK `contenedor_iso6346` rompe cotización→embarque** — Relajar CHECK para admitir `NULL`/`''`; cambiar el INSERT de `crear_embarque_borrador_core` a `NULL`. Crear los 2 índices únicos parciales anunciados en R2-22 (número por org, BL house por embarque).
4. **R3-04 · `convertir_proformas_a_factura`** — Corregir columnas de bitácora (`usuario_id`, `modulo`, `entidad_nombre`, `detalles`), quitar el segundo gate `_assert_writer` (deja el gate 1 con admin_org/contador/super_admin), poblar `conceptos_factura` desde `proforma_conceptos_consolidados` (fallback a `proforma_conceptos`/`conceptos_venta` cuando esté vacía), soportar EUR con `tipo_cambio_eur` o `LC_MONEDA_NO_SOPORTADA`, y DROP de la sobrecarga vieja `(uuid)`.
5. **R3-05 · `marcar_facturas_vencidas()` + cron** — Setear `app.recalc_estado_factura=1` dentro de la función para eximirse del guard. Envolver el `cron.schedule` en `DO $$ ... EXCEPTION WHEN OTHERS $$` con check de `pg_extension`.

## Bloque B — P1

6. **R3-06** — Guard cross-org en `validar_cierre_embarque` (`LC_ORG_FORBIDDEN`) + REVOKE EXECUTE de `_recalc_estado_proveedor_factura` a `authenticated`.
7. **R3-07** — En `validar_cierre_embarque`: agregar `v_puede := v_puede AND v_ok` en `margen_minimo`, comparar contra porcentaje real (`utilidad/venta*100`), y remover el `EXCEPTION WHEN OTHERS` que enmascara errores del PNL.
8. **R3-08** — Trigger en `embarques` que bloquee `UPDATE ... SET estado='Cerrado'` salvo cuando `app.cierre_embarque='1'`; setear esa marca dentro de `cerrar_embarque()`.
9. **R3-09** — Añadir policy `Soft delete pagos_factura` y equivalente en `pagos_proveedor` (USING con `deleted_at IS NULL`, WITH CHECK sin el filtro) para permitir marcar `deleted_at`.
10. **R3-10** — En la vista `embarque_estado_financiero`: restar NCs 'Aplicada' del saldo y convertir capturado/pagado a MXN antes de comparar contra presupuesto.
11. **R3-11** — Redefinir `costeo_tarifas_vigentes_v` filtrando por `estado='vigente'` y ventana `vigente_desde/hasta`.

## Bloque C — P2

12. **R3-12** — Índice único parcial `facturas_sustituye_a_unico` (vivas).
13. **R3-13** — DROP de sobrecargas viejas `actualizar_embarque_completo(uuid,jsonb,jsonb,jsonb)` y `crear_embarque_borrador_desde_cotizacion(uuid)`.
14. **R3-14** — Backfill de `folio_secuencias` con `MAX(numero)` por org/tipo (cotizaciones, proformas, facturas, embarques que apliquen).
15. **R3-15** — `handle_new_user_signup`: si `raw_user_meta_data->>'skip_auto_org'='true'` no insertar rol global ni crear org.
16. **R3-16** — En `calcular_comision_pago`: para `monto_cobrado_mxn` usar el TC del embarque según la moneda del pago cuando el TC del pago sea 1/default.
17. **R3-17** — Trigger `trg_pago_sin_rep_vivo_delete BEFORE DELETE` en `pagos_factura`.
18. **R3-18** — UX de guards: emitir `LC_PAGO_TC_REQUERIDO` desde el trigger (no CHECK físico) y separar `LC_PAGO_FACTURA_INEXISTENTE` de `LC_PAGO_FACTURA_SIN_ACCESO` haciendo un check de permisos previo con SECURITY DEFINER.
19. **R3-19** — Verificar y reordenar la migración `20260722125515` para fresh install; recrear la vista con `security_invoker=on` en el DDL (no depender de `ALTER VIEW` posterior).
20. **R3-20 · Menores** — CHECK de escala ≤2 decimales en `facturas.total`; validación `total ≈ cantidad*precio_unitario` (tolerancia 0.01) en `conceptos_venta`.

## Detalles técnicos

- **Formato de migraciones:** una migración por fix (o por grupo cohesivo), nombre `20260722HHMMSS_fix_r3_NN_<slug>.sql`. Todas con `CREATE OR REPLACE`, `DROP ... IF EXISTS`, `CREATE ... IF NOT EXISTS`, y DO-blocks tolerantes para pg_cron / extensiones opcionales.
- **Frontend:** solo se toca lo mínimo — el mapeo de nuevos códigos de error (`LC_PAGO_TC_REQUERIDO`, `LC_ORG_FORBIDDEN`, `LC_CIERRE_SOLO_RPC`, `LC_MONEDA_NO_SOPORTADA`, `LC_PAGO_FACTURA_SIN_ACCESO`) en el helper de mensajes amigables del feature correspondiente (pagos, cierre embarque, proforma→factura).
- **Servicios:** actualizar `convertir_proformas_a_factura` en el service de facturación si su firma cambia (sigue siendo la misma RPC; sólo cambia el comportamiento). Sin cambios de tipos.
- **Bump versión & CHANGELOG:** `APP_VERSION` a `13.307.0` y una entrada nueva `## [13.307.0] - 2026-07-22` listando los 20 fixes por ID (R3-01 … R3-20).
- **Pruebas de aceptación** (correr al final): fresh install desde migración 1; pago total CxC → factura pasa a Pagada; pago CxP MXN sin TC; conversión cotización→embarque; conversión proforma→factura como contador; cierre de embarque; `marcar_facturas_vencidas()`.

## Fuera de alcance

- Regla ESLint anti-`toISOString().slice(0,10)` (R3-20 punto 3): el código ya está limpio; se documenta en CHANGELOG y se pospone.
- Cualquier rediseño UI/UX no listado en los fixes.
