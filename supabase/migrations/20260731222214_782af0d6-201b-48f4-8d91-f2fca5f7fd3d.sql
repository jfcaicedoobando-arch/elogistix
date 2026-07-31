DO $do$
DECLARE
  v_fn text;
  v_def text;
  v_new text;
  v_funcs text[] := ARRAY[
    'embarques_admin_pendientes_count',
    'embarques_alertas_ids',
    'sidebar_alert_counts',
    'dashboard_stats',
    'dashboard_summary',
    'dashboard_details',
    'operaciones_stats'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_funcs LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Funcion public.% no encontrada', v_fn;
    END IF;

    v_new := v_def;
    v_new := replace(v_new,
      '(''Arribo'',''En Aduana'',''Entregado'',''EIR'',''Cerrado'')',
      '(''Arribo'',''En Aduana'',''Entregado'',''EIR'',''Por liquidar'',''Cerrado'')');
    v_new := replace(v_new,
      'NOT IN (''Borrador'',''EIR'',''Cerrado'',''Cancelado'')',
      'NOT IN (''Borrador'',''EIR'',''Por liquidar'',''Cerrado'',''Cancelado'')');
    v_new := replace(v_new,
      'NOT IN (''EIR'',''Cerrado'',''Cancelado'')',
      'NOT IN (''EIR'',''Por liquidar'',''Cerrado'',''Cancelado'')');
    v_new := replace(v_new,
      ' IN (''EIR'',''Cerrado'')',
      ' IN (''EIR'',''Por liquidar'',''Cerrado'')');
    v_new := replace(v_new,
      'IN (''Entregado'',''EIR'',''Cerrado'')',
      'IN (''Entregado'',''EIR'',''Por liquidar'',''Cerrado'')');
    v_new := replace(v_new,
      'IN (''Entregado'', ''EIR'')',
      'IN (''Entregado'', ''EIR'', ''Por liquidar'')');
    v_new := replace(v_new,
      '''EIR'', count(*) FILTER (WHERE estado_real = ''EIR'')',
      '''EIR'', count(*) FILTER (WHERE estado_real = ''EIR''),
        ''Por liquidar'', count(*) FILTER (WHERE estado_real = ''Por liquidar'')');

    IF v_new = v_def THEN
      RAISE EXCEPTION 'Sin cambios aplicados en public.% (patron no encontrado)', v_fn;
    END IF;

    EXECUTE v_new;
  END LOOP;
END
$do$;