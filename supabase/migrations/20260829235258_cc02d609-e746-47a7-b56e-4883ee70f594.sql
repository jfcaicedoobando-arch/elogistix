-- ============================================================
-- v13.808.0 · YAGNI Ola 10 — retiro de objetos sin consumidor
-- ============================================================
-- Alcance deliberadamente estrecho: NO se toca ningún candado
-- (_assert_*, _guard_soft_delete, RLS, GRANTs de tablas), ni reglas
-- fiscales/financieras, ni idempotencia.

-- 1) RPC de reconciliación histórica de un solo uso: sin llamador en
--    src/, en edge functions ni en cron. Se retira junto con sus GRANTs.
DROP FUNCTION IF EXISTS public.reconciliar_conceptos_facturados_legacy();

-- 2) purge_app_logs_old(): la migración original decía "el cron se programa
--    en otro paso" y ese paso nunca ocurrió, así que app_logs crecía sin
--    retención efectiva. Se agenda el job y se cierra el permiso a
--    service_role (authenticated lo tenía por drift y nadie lo usaba).
REVOKE ALL ON FUNCTION public.purge_app_logs_old() FROM authenticated;
REVOKE ALL ON FUNCTION public.purge_app_logs_old() FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_app_logs_old() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge_app_logs_diario')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'purge_app_logs_diario'
    );

    PERFORM cron.schedule(
      'purge_app_logs_diario',
      '30 7 * * *',  -- 01:30 America/Mexico_City
      $cmd$ SELECT public.purge_app_logs_old(); $cmd$
    );
  END IF;
END
$$;

COMMENT ON FUNCTION public.purge_app_logs_old() IS
  'Purga app_logs con más de 30 días. Agendada en pg_cron como purge_app_logs_diario (01:30 CDMX) desde v13.808.0.';