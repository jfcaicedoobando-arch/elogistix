-- Optimización RLS: envolver has_role() en (SELECT ...) para forzar evaluación
-- única por consulta (InitPlan) en lugar de por fila.
-- has_role es STABLE => resultado idéntico, semántica de permisos intacta.
DO $do$
DECLARE
  r             record;
  v_qual        text;
  v_check       text;
  v_new_qual    text;
  v_new_check   text;
  v_sql         text;
  v_convertidas int := 0;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname, p.cmd,
           p.roles::text[] AS roles, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        coalesce(p.qual, '')       ~ '(?<!SELECT )has_role\('
        OR coalesce(p.with_check, '') ~ '(?<!SELECT )has_role\('
      )
    ORDER BY p.tablename, p.policyname
  LOOP
    v_qual  := r.qual;
    v_check := r.with_check;

    -- Forma A: has_role(( SELECT auth.uid() AS uid), 'rol'::app_role)
    v_new_qual := regexp_replace(
      coalesce(v_qual, ''),
      'has_role\(\(\s*SELECT auth\.uid\(\) AS uid\),\s*(''[a-z_]+''::app_role)\)',
      '(SELECT has_role((SELECT auth.uid()), \1))',
      'g');
    -- Forma B: has_role(auth.uid(), 'rol'::app_role)
    v_new_qual := regexp_replace(
      v_new_qual,
      'has_role\(auth\.uid\(\),\s*(''[a-z_]+''::app_role)\)',
      '(SELECT has_role((SELECT auth.uid()), \1))',
      'g');

    v_new_check := regexp_replace(
      coalesce(v_check, ''),
      'has_role\(\(\s*SELECT auth\.uid\(\) AS uid\),\s*(''[a-z_]+''::app_role)\)',
      '(SELECT has_role((SELECT auth.uid()), \1))',
      'g');
    v_new_check := regexp_replace(
      v_new_check,
      'has_role\(auth\.uid\(\),\s*(''[a-z_]+''::app_role)\)',
      '(SELECT has_role((SELECT auth.uid()), \1))',
      'g');

    IF v_qual IS NULL  THEN v_new_qual  := NULL; END IF;
    IF v_check IS NULL THEN v_new_check := NULL; END IF;

    IF v_new_qual IS NOT DISTINCT FROM v_qual
       AND v_new_check IS NOT DISTINCT FROM v_check THEN
      CONTINUE;
    END IF;

    -- Seguridad: si quedó alguna llamada sin envolver, abortar todo.
    IF (coalesce(v_new_qual, '') || ' ' || coalesce(v_new_check, '')) ~ '(?<!SELECT )has_role\(' THEN
      RAISE EXCEPTION 'Politica %.% quedo con has_role sin envolver: % / %',
        r.tablename, r.policyname, v_new_qual, v_new_check;
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    v_sql := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s',
      r.policyname, r.tablename, r.cmd,
      (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x));

    IF v_new_qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_new_qual);
    END IF;
    IF v_new_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_new_check);
    END IF;

    EXECUTE v_sql;
    v_convertidas := v_convertidas + 1;
  END LOOP;

  RAISE NOTICE 'Politicas RLS optimizadas: %', v_convertidas;
END
$do$;

-- Verificación dura: ninguna política debe conservar has_role() fuera de un (SELECT ...).
DO $verify$
DECLARE
  v_pendientes int;
BEGIN
  SELECT count(*) INTO v_pendientes
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      coalesce(qual, '')       ~ '(?<!SELECT )has_role\('
      OR coalesce(with_check, '') ~ '(?<!SELECT )has_role\('
    );

  IF v_pendientes > 0 THEN
    RAISE EXCEPTION 'Quedaron % politicas con has_role() sin optimizar; se revierte todo.', v_pendientes;
  END IF;
END
$verify$;