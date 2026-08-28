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
  ('public._assert_periodo_abierto()'),
  ('public._assert_uuid_fiscal_single_write()'),
  ('public._audit_embarques_agregar(jsonb, jsonb)'),
  ('public._audit_embarques_umbrales(uuid)'),
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
  -- Trigger de alerta de retenciones vs NC (Sub-ola D): sólo lo dispara el trigger.
  ('public._nc_alerta_retenciones_pagadas()'),
  ('public._nc_prov_tc_moneda_convertible()'),
  ('public._recalc_estado_proveedor_factura(uuid)'),
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
  ('public.delete_email(text, bigint)'),
  ('public.email_send_log_touch(text, text, text, text, text)'),
  ('public.enqueue_email(text, jsonb)'),
  ('public.ensure_demo_membership(uuid)'),

  -- Función trigger de auth.users: la ejecuta el trigger, nunca un cliente.
  ('public.handle_new_user_signup()'),
  ('public.marcar_facturas_vencidas()'),
  ('public.move_to_dlq(text, text, bigint, jsonb)'),
  ('public.nc_aplicadas_en_moneda_factura(uuid)'),
  ('public.notificar_uuid_cancelado_sat(uuid, jsonb)'),
  ('public.promover_embarque_por_liquidar(uuid)'),
  ('public.read_email_batch(text, integer, integer)'),
  ('public.registrar_comision_pendiente(uuid, uuid, text, text, text, text)'),
  ('public.reprocesar_comisiones_job()'),
  ('public.seed_demo_organization_core()'),
  ('public.seed_demo_organization_guarded(bigint)'),
  ('public.seleccionar_lote_sat_semanal(integer)'),
  ('public.tg_facturas_link_proforma()'),
  ('public.tg_liberar_folio_proveedor_factura()'),
  ('public.venta_embarque_mxn_neta(uuid, numeric, numeric)');
