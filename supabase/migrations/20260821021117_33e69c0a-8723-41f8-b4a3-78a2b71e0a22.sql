-- ============================================================================
-- Ola 2 · Fase B2 (fix) — El chequeo previo usaba to_regproc('cron.schedule'),
-- que devuelve NULL cuando el nombre está sobrecargado (pg_cron define varias
-- firmas). Resultado: ambos agendados se omitieron. Se detecta por pg_proc.
-- ============================================================================

DO $cron$
DECLARE
  v_tiene_cron boolean;
  v_jobid   bigint;
  v_cmd     text;
  v_headers text;
  v_base    text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) INTO v_tiene_cron;

  IF NOT v_tiene_cron THEN
    RAISE NOTICE 'pg_cron no disponible: se omiten los agendados de la Ola 2 Fase B2';
    RETURN;
  END IF;

  -- 1) Reproceso diario de comisiones pendientes (06:20 UTC ≈ 00:20 MX).
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'reprocesar_comisiones_diario';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'reprocesar_comisiones_diario',
    '20 6 * * *',
    $CRON$ SELECT public.reprocesar_comisiones_job(); $CRON$
  );

  -- 2) Verificación SAT semanal (lunes 14:00 UTC ≈ 08:00 MX). Los encabezados
  --    se copian de un job HTTP existente para no versionar secretos.
  SELECT command INTO v_cmd
    FROM cron.job
   WHERE jobname IN ('tc-dof-diario', 'rep-retry-nocturno')
   ORDER BY jobname
   LIMIT 1;

  IF v_cmd IS NULL THEN
    RAISE NOTICE 'Sin job HTTP de referencia: se omite el agendado de verificar_sat_semanal';
    RETURN;
  END IF;

  v_headers := substring(v_cmd from 'headers := ''(\{.*\})''::jsonb');
  v_base    := substring(v_cmd from 'url := ''(https://[^/]+)/functions/v1/');

  IF v_headers IS NULL OR v_base IS NULL THEN
    RAISE NOTICE 'No se pudieron leer los encabezados del job de referencia: se omite verificar_sat_semanal';
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'verificar_sat_semanal';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'verificar_sat_semanal',
    '0 14 * * 1',
    format(
      $CRON$SELECT net.http_post(url := %L, headers := %L::jsonb, body := jsonb_build_object('trigger','cron','at', now())) AS request_id;$CRON$,
      v_base || '/functions/v1/verificar-sat-semanal',
      v_headers
    )
  );
END
$cron$;
