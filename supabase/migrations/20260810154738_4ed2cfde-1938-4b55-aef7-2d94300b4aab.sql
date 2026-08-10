DO $do$
DECLARE
  r record;
  src text;
BEGIN
  FOR r IN
    SELECT oid, proname FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname IN ('dashboard_summary','dashboard_details','operaciones_stats')
  LOOP
    src := pg_get_functiondef(r.oid);
    src := replace(src,
      'WHEN e.estado IN (''Arribo''',
      'WHEN e.estado = ''Borrador'' THEN ''Borrador''
          WHEN e.estado IN (''Arribo''');
    src := replace(src, 'NOT IN (''EIR''', 'NOT IN (''Borrador'',''EIR''');
    EXECUTE src;
  END LOOP;
END
$do$;