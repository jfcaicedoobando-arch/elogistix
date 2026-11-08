-- Guard: finanzas y gerencias leen liquidaciones de SU empresa; nadie escribe directo.
BEGIN;

INSERT INTO public.organizations (id, nombre) VALUES
  ('a1a10000-0000-4000-8000-000000000001'::uuid, 'Liq Org A'),
  ('b2b20000-0000-4000-8000-000000000002'::uuid, 'Liq Org B');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('a1a10000-0000-4000-8000-0000000000c1', 'liq-contador@test.mx'),
      ('a1a10000-0000-4000-8000-0000000000c2', 'liq-gerente@test.mx'),
      ('a1a10000-0000-4000-8000-0000000000c3', 'liq-coord@test.mx'),
      ('a1a10000-0000-4000-8000-0000000000c4', 'liq-vendedora@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('a1a10000-0000-4000-8000-000000000001', 'a1a10000-0000-4000-8000-0000000000c1', 'contador'),
  ('a1a10000-0000-4000-8000-000000000001', 'a1a10000-0000-4000-8000-0000000000c2', 'gerente_comercial'),
  ('a1a10000-0000-4000-8000-000000000001', 'a1a10000-0000-4000-8000-0000000000c3', 'coordinador_logistico')
ON CONFLICT DO NOTHING;

INSERT INTO public.liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn) VALUES
  ('a1a10000-0000-4000-8000-000000000001', 'a1a10000-0000-4000-8000-0000000000c4', '2026-10', 100),
  ('b2b20000-0000-4000-8000-000000000002', 'a1a10000-0000-4000-8000-0000000000c4', '2026-10', 200);

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE FUNCTION pg_temp.ver(p_uid uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.liquidaciones_comision
   WHERE vendedora_id = 'a1a10000-0000-4000-8000-0000000000c4';
  RESET ROLE;
  RETURN n;
END $$;

DO $casos$
DECLARE n integer;
BEGIN
  n := pg_temp.ver('a1a10000-0000-4000-8000-0000000000c1');
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO: contador ve % liquidaciones (esperado 1, sólo su empresa)', n; END IF;
  n := pg_temp.ver('a1a10000-0000-4000-8000-0000000000c2');
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO: gerente comercial ve % (esperado 1)', n; END IF;
  n := pg_temp.ver('a1a10000-0000-4000-8000-0000000000c3');
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO: coordinador ve % (esperado 0)', n; END IF;

  IF has_table_privilege('authenticated', 'public.liquidaciones_comision', 'INSERT')
     AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liquidaciones_comision'
                 AND cmd IN ('INSERT','UPDATE','DELETE','ALL') AND permissive = 'PERMISSIVE') THEN
    RAISE EXCEPTION 'FALLO: existe una ruta de escritura directa a liquidaciones';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liquidaciones_comision'
             AND permissive = 'PERMISSIVE' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALLO: política permisiva de escritura en liquidaciones';
  END IF;
  RAISE NOTICE '✓ liquidaciones: finanzas/gerencia leen su empresa, coordinador no, sin escritura directa';
END
$casos$ LANGUAGE plpgsql;

ROLLBACK;
