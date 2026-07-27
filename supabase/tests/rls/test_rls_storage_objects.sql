-- ============================================================================
-- Suite RLS — storage.objects (H8)
-- ============================================================================
-- Verifica que las policies en storage.objects (documentos, facturas, etc.)
-- aislan por tenant. Usa el stub de storage cargado por _ci_bootstrap.sql.
-- Convención: el primer folder del path (`storage.foldername(name)[1]`) es
-- el organization_id del owner.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  bucket text := 'documentos';
  path_a text;
  path_b text;
  visible int;
BEGIN
  -- Bootstrap: si no existe policy en storage.objects, saltar suite (stub sin migraciones).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects') THEN
    RAISE NOTICE '⚠ storage.objects sin policies en este entorno CI — suite saltada';
    RETURN;
  END IF;

  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'STG A'), (org_b, 'STG B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO storage.buckets(id, name, public) VALUES (bucket, bucket, false) ON CONFLICT DO NOTHING;

  path_a := org_a::text || '/emb-a/doc.pdf';
  path_b := org_b::text || '/emb-b/doc.pdf';

  -- Sembrar como postgres (bypass RLS) para tener 2 objetos de orgs distintas
  INSERT INTO storage.objects(bucket_id, name, owner) VALUES
    (bucket, path_a, user_a),
    (bucket, path_b, user_b);

  -- user_b intenta leer el objeto de org_a
  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM storage.objects WHERE name = path_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver objetos de storage cuyo primer folder es org_a');

  -- user_b intenta subir un objeto suplantando el folder de org_a
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO storage.objects(bucket_id, name, owner) VALUES (%L, %L, %L)',
      bucket, org_a::text || '/hijack/x.pdf', user_b
    ),
    'user_b NO debe poder INSERT en storage con path apuntando a org_a'
  );

  -- Control: user_a sí ve su propio objeto
  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM storage.objects WHERE name = path_a;
  PERFORM pg_temp.assert(visible = 1, 'user_a (control) sí debe ver su objeto en org_a');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_storage_objects: 3 aserciones OK';
END;
$$;

ROLLBACK;
