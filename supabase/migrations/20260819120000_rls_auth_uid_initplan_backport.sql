-- ============================================================================
-- P3: Backport de initplan en políticas RLS
-- ----------------------------------------------------------------------------
-- Envuelve auth.uid() / auth.jwt() crudos en (SELECT auth.uid()) /
-- (SELECT auth.jwt()) para TODAS las políticas vivas del schema public y de
-- storage.objects, reconstruyendo el DDL desde pg_policies.
--
-- Motivación: ~242 de ~336 políticas vivas usan auth.uid()/auth.jwt() sin
-- envolver; Postgres re-evalúa la función por fila en vez de tratarla como
-- InitPlan (una sola evaluación por query). El reemplazo textual se hace en
-- un DO idempotente para no reescribir 242 CREATE POLICY a mano.
--
-- Garantías:
--   * Idempotente: solo se tocan políticas cuyo qual/with_check contiene la
--     llamada cruda; las ya envueltas '(SELECT auth.uid())' (deparsadas por
--     Postgres como '( SELECT auth.uid() AS uid)') no se vuelven a envolver.
--   * Se preservan nombre, tabla, AS PERMISSIVE/RESTRICTIVE, FOR <cmd>,
--     TO <roles> y WITH CHECK solo si no es NULL.
--   * Una sola transacción (las migraciones de Supabase ya corren en tx;
--     no se usa COMMIT).
--   * Al final se verifica que no quede ninguna política con el patrón crudo;
--     si queda alguna, RAISE EXCEPTION (rollback de toda la migración).
-- ============================================================================

DO $$
DECLARE
  r            record;
  v_qual       text;
  v_check      text;
  v_roles      text;
  v_has_raw    boolean;
  v_rewritten  integer := 0;
  v_pending    integer;
  -- Patrón de llamada YA envuelta tal como la deparsea Postgres:
  --   ( SELECT auth.uid() AS uid)  /  (SELECT auth.uid())  (cualquier casing)
  c_wrapped_uid constant text := '\(\s*select\s+auth\.uid\(\)\s*(as\s+\w+\s*)?\)';
  c_wrapped_jwt constant text := '\(\s*select\s+auth\.jwt\(\)\s*(as\s+\w+\s*)?\)';
  c_raw         constant text := 'auth\.(uid|jwt)\(\)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
       OR (schemaname = 'storage' AND tablename = 'objects')
    ORDER BY schemaname, tablename, policyname
  LOOP
    -- ¿Tiene la llamada CRUDA (fuera de un subselect)? Se decide así (y no
    -- por comparación textual) porque Postgres deparsea '(SELECT auth.uid())'
    -- como '( SELECT auth.uid() AS uid)', lo que rompería la idempotencia si
    -- comparáramos textos.
    v_has_raw :=
      (r.qual IS NOT NULL
        AND regexp_replace(regexp_replace(r.qual, c_wrapped_uid, '', 'gi'),
                           c_wrapped_jwt, '', 'gi') ~* c_raw)
      OR
      (r.with_check IS NOT NULL
        AND regexp_replace(regexp_replace(r.with_check, c_wrapped_uid, '', 'gi'),
                           c_wrapped_jwt, '', 'gi') ~* c_raw);

    IF NOT v_has_raw THEN
      CONTINUE;  -- política limpia: no se toca (idempotencia)
    END IF;

    v_qual  := r.qual;
    v_check := r.with_check;

    -- Reescritura:
    -- 1) Se sustituyen las ocurrencias YA envueltas por un marcador,
    -- 2) se envuelve todo auth.uid()/auth.jwt() restante (crudo),
    -- 3) se restauran los marcadores a su forma envuelta normalizada.
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, c_wrapped_uid, E'\x01', 'gi');
      v_qual := regexp_replace(v_qual, c_wrapped_jwt, E'\x02', 'gi');
      v_qual := regexp_replace(v_qual, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      v_qual := regexp_replace(v_qual, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      v_qual := replace(v_qual, E'\x01', '(SELECT auth.uid())');
      v_qual := replace(v_qual, E'\x02', '(SELECT auth.jwt())');
    END IF;

    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, c_wrapped_uid, E'\x01', 'gi');
      v_check := regexp_replace(v_check, c_wrapped_jwt, E'\x02', 'gi');
      v_check := regexp_replace(v_check, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      v_check := regexp_replace(v_check, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      v_check := replace(v_check, E'\x01', '(SELECT auth.uid())');
      v_check := replace(v_check, E'\x02', '(SELECT auth.jwt())');
    END IF;

    -- pg_policies.roles es text[] -> 'TO rol1, rol2'
      SELECT string_agg(quote_ident(x), ', ') INTO v_roles FROM unnest(r.roles) AS x;
      IF v_roles IS NULL THEN
        v_roles := 'PUBLIC';
      END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname,
      r.schemaname,
      r.tablename,
      r.permissive,                       -- PERMISSIVE | RESTRICTIVE
      r.cmd,                              -- ALL | SELECT | INSERT | UPDATE | DELETE
      v_roles,
      CASE WHEN v_qual IS NOT NULL
           THEN format(' USING (%s)', v_qual) ELSE '' END,
      CASE WHEN v_check IS NOT NULL
           THEN format(' WITH CHECK (%s)', v_check) ELSE '' END
    );

    v_rewritten := v_rewritten + 1;
    RAISE NOTICE 'P3 reescrita: %.%  política "%" (%)',
      r.schemaname, r.tablename, r.policyname, r.cmd;
  END LOOP;

  RAISE NOTICE 'P3: % políticas reescritas con (SELECT auth.uid()/auth.jwt())', v_rewritten;

  -- ------------------------------------------------------------------------
  -- Verificación: no debe quedar NINGUNA política con auth.uid()/auth.jwt()
  -- crudo (fuera de un subselect). Si queda alguna, abortar la migración.
  -- ------------------------------------------------------------------------
  SELECT count(*) INTO v_pending
  FROM pg_policies
  WHERE (schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects'))
    AND (
      (qual IS NOT NULL
        AND regexp_replace(regexp_replace(qual, c_wrapped_uid, '', 'gi'),
                           c_wrapped_jwt, '', 'gi') ~* c_raw)
      OR
      (with_check IS NOT NULL
        AND regexp_replace(regexp_replace(with_check, c_wrapped_uid, '', 'gi'),
                           c_wrapped_jwt, '', 'gi') ~* c_raw)
    );

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'P3: quedan % políticas con auth.uid()/auth.jwt() crudo tras el backport', v_pending;
  END IF;

  RAISE NOTICE 'P3: verificación OK, 0 políticas con patrón crudo restantes';
END $$;
