-- Optimización RLS: envolver funciones de contexto en (SELECT ...) para caching por-query
-- Referencia: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DO $rlsopt$
DECLARE
  r          record;
  new_qual   text;
  new_check  text;
  changed    boolean;
  fn_pattern text;
  fn_list    text[] := ARRAY[
    'auth\.uid',
    'current_user_org_id',
    'current_user_client_ids',
    'current_agente_id',
    'current_agente_org',
    'current_user_id'
  ];
  fn         text;
  stmt       text;
  n_updated  int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;
    changed   := false;

    FOREACH fn IN ARRAY fn_list LOOP
      -- Reemplaza `fn()` con `(SELECT fn())` solo cuando NO esté precedido por "SELECT "
      -- (?<!...) es lookbehind negativo; \m es word-boundary de Postgres
      fn_pattern := '(?<!SELECT )\m' || fn || '\(\)';

      IF new_qual IS NOT NULL AND new_qual ~ fn_pattern THEN
        new_qual := regexp_replace(new_qual, fn_pattern, '(SELECT ' || replace(fn, '\.', '.') || '())', 'g');
        changed := true;
      END IF;
      IF new_check IS NOT NULL AND new_check ~ fn_pattern THEN
        new_check := regexp_replace(new_check, fn_pattern, '(SELECT ' || replace(fn, '\.', '.') || '())', 'g');
        changed := true;
      END IF;
    END LOOP;

    IF NOT changed THEN
      CONTINUE;
    END IF;

    -- Construir ALTER POLICY. ALTER POLICY permite modificar USING y WITH CHECK sin tocar cmd/roles.
    stmt := format('ALTER POLICY %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);

    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    BEGIN
      EXECUTE stmt;
      n_updated := n_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'RLS opt fallo en %.% policy %: % — stmt: %',
                    r.schemaname, r.tablename, r.policyname, SQLERRM, stmt;
    END;
  END LOOP;

  RAISE NOTICE 'RLS optimization: % policies actualizadas', n_updated;
END
$rlsopt$;