-- ============================================================================
-- Lista canónica de funciones service_role-only (FIX4 tanda 4 · P3).
--
-- ÚNICA fuente de verdad del patrón "sólo service_role / llamadas internas
-- DEFINER". Se consume con \ir desde:
--   · _ci_post_migrate.sql            → re-cierra todo lo de la lista tras el
--                                       GRANT masivo del Postgres bare de CI.
--   · _ci_check_service_role_only.sql → candado bidireccional que corre ANTES
--                                       del re-cierre (ver su encabezado).
--   · ../fix4_service_role_only_grants.sql → verifica el estado ya re-cerrado.
--
-- El script deja la lista en la tabla TEMP de sesión `_ci_service_role_only`
-- (psql no empalma \ir dentro de una sentencia a medias, por eso el archivo
-- es autocontenido).
--
-- Reglas al tocar la lista:
--   · Toda función aquí listada DEBE traer su REVOKE en su propia migración
--     (el candado bidireccional falla si no).
--   · Toda función service_role-only nueva DEBE añadirse aquí en la misma PR
--     (el candado falla si falta).
--   · Si una función cambia de firma o se elimina, actualiza su entrada en la
--     misma PR (el candado marca entradas obsoletas).
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._ci_service_role_only;
CREATE TEMP TABLE _ci_service_role_only (fn text);
INSERT INTO _ci_service_role_only (fn) VALUES
  ('public._assert_concepto_no_proformado()'),
  ('public._assert_padre_misma_org()'),
  -- Ola P1 (P1-4): validación cross-org de cliente/cotización/proveedores.
  ('public._assert_relaciones_embarque(uuid, uuid, uuid, jsonb)'),

  -- v15 (M-14): banda de plausibilidad del T/C en pagos CxC/CxP.
  ('public._assert_tc_banda()'),
  -- Trigger de tesorería: impide dar de baja cuentas con movimientos.
  ('public._cuenta_bancaria_guard_baja()'),
  -- v13.823.51 · candados multiempresa CRM + probabilidad terminal.
  ('public._cotizacion_oportunidad_misma_org()'),
  ('public._crm_actividad_entidad_misma_org()'),
  ('public._crm_probabilidad_terminal()'),
  ('public._crm_oportunidad_etapa_motivo_misma_org()'),
  -- v13.823.54 · candados cross-org restantes del CRM (origen, criterios,
  -- cumplimiento, comentarios) y notificación de comentario blindada.
  ('public._crm_oportunidad_requiere_origen()'),
  ('public._crm_criterio_etapa_misma_org()'),
  ('public._crm_cumplimiento_misma_org()'),
  ('public._crm_comentario_oportunidad_misma_org()'),
  -- v13.823.6x · candados CRM de conversión y sincronía con cotizaciones:
  -- son triggers/RPC internos DEFINER, nunca los llama el cliente.
  ('public._crm_actividad_toca_oportunidad()'),
  ('public._crm_sync_oportunidad_desde_cotizacion()'),
  ('public.crm_cerrar_oportunidad_desde_cotizacion()'),
  ('public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date)'),
  ('public.crm_propagar_conversion_cliente(uuid, uuid, text)'),
  ('public.crm_notify_comentario_oportunidad()'),
  ('public._assert_periodo_abierto()'),
  -- Lectura bloqueada (FOR KEY SHARE) del estado del embarque: sólo la usan
  -- los triggers SECURITY DEFINER de bloqueo por cierre.
  ('public._assert_embarque_abierto_locked(uuid)'),
  ('public._assert_uuid_fiscal_single_write()'),
  ('public._audit_costos_repetidos(uuid)'),
  ('public._audit_embarques_agregar(jsonb, jsonb)'),
  ('public._audit_embarques_umbrales(uuid)'),
  -- Triggers de candados financieros (Ola E4): sólo los dispara el motor.
  ('public._bbva_guard_update()'),
  -- Bitácora financiera (N19): trigger interno, nunca lo llama un cliente.
  ('public._bitacora_cambio_financiero()'),
  ('public._liquidacion_guard_estado()'),
  ('public._prohibir_delete_comisiones()'),
  ('public._cotizaciones_bloquear_auto_aceptacion()'),
  ('public._cotizaciones_bloquear_envio_sin_oportunidad()'),
  ('public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb)'),
  ('public._crm_vincular_cotizacion_core(uuid, jsonb, uuid, uuid, text, uuid)'),
  -- Helper interno del flujo de aprobación CxP (SECURITY DEFINER, corre como
  -- dueño); no debe ser ejecutable directo por authenticated (Ola A 2026-08-28).
  ('public._cxp_validar_aprobacion(uuid, text)'),
  -- Cálculo interno de los tableros: sólo lo invocan las RPC DEFINER
  -- dashboard_summary()/dashboard_details() (enmascaran costos por rol).
  ('public._dashboard_details_calc()'),
  ('public._dashboard_summary_calc()'),
  -- Helper de rol interno (Ola E4): sólo lo usan RPC/policies DEFINER.
  ('public._es_rol_interno()'),
  -- Trigger de folio monotónico por serie (v13.823.43): sólo lo dispara el trigger.
  ('public._factura_serie_folio_monotonico()'),

  -- Trigger de alerta de retenciones vs NC (Sub-ola D): sólo lo dispara el trigger.
  ('public._nc_alerta_retenciones_pagadas()'),
  -- Trigger F5 (ronda 3): tope de saldo en NCs de proveedor; sólo el trigger.
  ('public._assert_nc_prov_no_excede_saldo()'),
  -- Trigger B-4 (v14-2): PUE de una sola exhibición; sólo lo dispara el trigger.
  ('public._assert_pago_pue_exhibicion_unica()'),
  ('public._nc_prov_tc_moneda_convertible()'),
  ('public._recalc_estado_proveedor_factura(uuid)'),
  ('public._recompute_totales_embarque(uuid)'),
  -- v15 (M-15): exposición de crédito sin checks de sesión (la usa el timbrado).
  ('public.credito_en_uso_mxn(uuid)'),
  ('public._reprocesar_comisiones_org(uuid)'),
  ('public._seed_demo_limpiar_financiero()'),
  ('public._sync_user_roles_desde_membership()'),
  ('public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text, numeric)'),

  -- RPC vieja del buzón CxP (M-7): cerrada a todos en migraciones; el
  -- re-cierre la mantiene así (grant a service_role por compatibilidad con
  -- el post_migrate previo a FIX4).
  ('public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text)'),
  ('public.assert_pago_sin_rep_vivo_delete()'),
  -- Auditorías/backfills internos: los corre soporte con service_role.
  ('public.auditoria_pfc_huerfanos()'),
  ('public.backfill_conceptos_venta_facturados()'),
  ('public.backfill_proformas_aceptadas()'),
  ('public.calc_pago_retenciones()'),
  ('public.calcular_comision_pago()'),
  ('public.cierre_periodo_fecha(uuid)'),
  ('public.comision_embarques_de_factura(uuid)'),
  ('public.crm_backfill_cotizaciones_sin_oportunidad()'),
  ('public.cron_try_lock(text, integer, text)'),
  ('public.cron_unlock(text)'),
  ('public.dashboard_details_datos()'),
  ('public.dashboard_summary_datos()'),
  ('public.email_send_log_touch(text, text, text, text, text)'),
  ('public.ensure_demo_membership(uuid)'),

  -- Función trigger de auth.users: la ejecuta el trigger, nunca un cliente.
  ('public.handle_new_user_signup()'),
  ('public.marcar_facturas_vencidas()'),
  ('public.nc_aplicadas_en_moneda_factura(uuid)'),
  ('public.notificar_uuid_cancelado_sat(uuid, jsonb)'),
  ('public.promover_embarque_por_liquidar(uuid)'),
  -- v13.808.0 (YAGNI Ola 10): retención de app_logs; sólo la corre el cron.
  ('public.purge_app_logs_old()'),
  ('public.registrar_comision_pendiente(uuid, uuid, text, text, text, text)'),
  ('public.reprocesar_comisiones_job()'),
  ('public.seed_demo_organization_core()'),
  ('public.seed_demo_organization_guarded(bigint)'),
  ('public.seleccionar_lote_sat_semanal(integer)'),
  ('public.tg_facturas_link_proforma()'),
  ('public.tg_liberar_folio_proveedor_factura()'),
  ('public.venta_embarque_mxn_neta(uuid, numeric, numeric)');
