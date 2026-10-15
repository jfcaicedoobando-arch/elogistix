-- Idempotent replay of immutable Drizzle 0015. No role, enum or ACL changes.
-- Existing policies must match the historical definition; drift aborts unchanged.
DO $replay_catalogos_0015$
DECLARE
  v_previous_search_path text := current_setting('search_path');
  v_authenticated oid;
  v_table_name text;
  v_table regclass;
  v_policy_name text;
  v_policy pg_catalog.pg_policy%ROWTYPE;
  v_expected_check constant text := $expected$(( SELECT has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), 'gerente_operaciones'::app_role) AS has_role))$expected$;
BEGIN
  PERFORM set_config('search_path', 'public, pg_catalog', true);
  IF to_regtype('app_role') IS DISTINCT FROM to_regtype('public.app_role') THEN
    RAISE EXCEPTION 'CATALOGOS_0015_ENUM_RESOLUTION_DRIFT';
  END IF;
  PERFORM 'admin'::public.app_role, 'gerente_operaciones'::public.app_role;
  SELECT oid INTO v_authenticated FROM pg_catalog.pg_roles WHERE rolname = 'authenticated';
  IF v_authenticated IS NULL THEN
    RAISE EXCEPTION 'CATALOGOS_0015_AUTHENTICATED_MISSING';
  END IF;

  LOCK TABLE public.navieras, public.puertos, public.tipos_contenedor IN SHARE ROW EXCLUSIVE MODE;
  FOREACH v_table_name IN ARRAY ARRAY['navieras', 'puertos', 'tipos_contenedor'] LOOP
    v_table := to_regclass('public.' || v_table_name);
    v_policy_name := 'Gerente operaciones y admins dan de alta ' || v_table_name;
    SELECT * INTO v_policy FROM pg_catalog.pg_policy
      WHERE polrelid = v_table AND polname = v_policy_name;
    IF FOUND AND (
      v_policy.polcmd IS DISTINCT FROM 'a'
      OR v_policy.polpermissive IS DISTINCT FROM true
      OR v_policy.polroles IS DISTINCT FROM ARRAY[v_authenticated]::oid[]
      OR v_policy.polqual IS NOT NULL
      OR pg_get_expr(v_policy.polwithcheck, v_policy.polrelid) IS DISTINCT FROM v_expected_check
    ) THEN
      RAISE EXCEPTION 'CATALOGOS_0015_POLICY_DRIFT: %', v_policy_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.navieras'::regclass AND polname = 'Gerente operaciones y admins dan de alta navieras') THEN
    DROP POLICY IF EXISTS "Gerente operaciones y admins dan de alta navieras" ON public.navieras;
CREATE POLICY "Gerente operaciones y admins dan de alta navieras" ON public.navieras FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.puertos'::regclass AND polname = 'Gerente operaciones y admins dan de alta puertos') THEN
    DROP POLICY IF EXISTS "Gerente operaciones y admins dan de alta puertos" ON public.puertos;
CREATE POLICY "Gerente operaciones y admins dan de alta puertos" ON public.puertos FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tipos_contenedor'::regclass AND polname = 'Gerente operaciones y admins dan de alta tipos_contenedor') THEN
    DROP POLICY IF EXISTS "Gerente operaciones y admins dan de alta tipos_contenedor" ON public.tipos_contenedor;
CREATE POLICY "Gerente operaciones y admins dan de alta tipos_contenedor" ON public.tipos_contenedor FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role)));
  END IF;

  PERFORM set_config('search_path', v_previous_search_path, true);
END
$replay_catalogos_0015$;
