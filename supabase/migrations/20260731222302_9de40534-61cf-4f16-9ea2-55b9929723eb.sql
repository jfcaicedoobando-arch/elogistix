DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'dashboard_details' LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Funcion public.dashboard_details no encontrada';
  END IF;

  v_new := replace(v_def,
    'WHERE estado_real = ''EIR''',
    'WHERE estado_real IN (''EIR'',''Por liquidar'')');

  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patron no encontrado en dashboard_details';
  END IF;

  EXECUTE v_new;
END
$do$;