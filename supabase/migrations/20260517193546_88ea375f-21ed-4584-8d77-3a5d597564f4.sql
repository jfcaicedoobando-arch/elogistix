-- =========================================================
-- Sprint A.1: hardening de SECURITY DEFINER expuestos
-- =========================================================
-- Estrategia:
--   1. REVOKE EXECUTE FROM PUBLIC en TODA función SECURITY DEFINER del schema public.
--   2. GRANT EXECUTE TO authenticated SOLO en las funciones RPC que la app llama.
--   3. Funciones que son trigger handlers: no se vuelve a otorgar (no son RPC).
-- =========================================================

-- --- Funciones RPC (app firmada las llama) ---
REVOKE EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auditoria_capturar_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auditoria_capturar_snapshot(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.consolidar_proformas(uuid, uuid[], uuid, uuid, text, text, text, text, integer, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidar_proformas(uuid, uuid[], uuid, uuid, text, text, text, text, integer, numeric, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.duplicar_embarque_completo(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicar_embarque_completo(uuid, jsonb, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.idempotency_claim(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.idempotency_claim(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.idempotency_store(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.idempotency_store(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_idempotency_log(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_idempotency_log(integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_trash(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_trash(text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.marcar_proforma_facturada(uuid, text, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_proforma_facturada(uuid, text, date, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_record(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_record(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_record(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated;

-- --- Trigger handlers / cron: revoke total, no se otorga ---
REVOKE EXECUTE ON FUNCTION public.congelar_factura_al_emitir() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.congelar_proforma_al_aprobar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notif_cli_on_embarque_estado() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detectar_alertas_app_logs() FROM PUBLIC;

-- =========================================================
-- Nota sobre extensión pg_trgm en public:
-- Se mantiene en public porque hay índices GIN existentes
-- que dependen de la extensión. Mover requeriría recrear
-- los índices y validar performance. Riesgo aceptado:
-- pg_trgm sólo expone operadores de similitud de texto,
-- no funciones de acceso a datos.
-- =========================================================
