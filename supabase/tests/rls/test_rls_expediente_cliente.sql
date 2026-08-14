-- ============================================================================
-- Suite RLS — expediente de cliente y contactos de proveedor (R4BD-04)
-- ============================================================================
-- Verifica la matriz de roles de escritura añadida por
-- 20260824050000_ola13_has_role_cliente.sql:
--   1. Un rol fuera de la matriz (customer_service) NO puede
--      INSERT/UPDATE/DELETE en public.cliente_documentos ni en
--      public.proveedor_contactos.
--   2. admin_org SÍ puede (control positivo).
--   3. La lectura sigue siendo org-scoped: el viewer ve lo de su org y
--      NO los de otra org.
--   4. Bypass super_admin de lectura intacto (policy SELECT no tocada).
--   5. "Cliente docs read" sigue exigiendo d.deleted_at IS NULL: al dar de
--      baja lógica el documento, el objeto deja de ser legible.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_expediente_cliente.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- Nota de mecánica RLS: un INSERT rechazado por WITH CHECK lanza 23514, pero
-- un UPDATE/DELETE cuyo USING no pasa NO lanza error: afecta 0 filas. Por eso
-- esos casos se verifican comprobando que la fila persiste sin cambios.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  super_u uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  prov_a uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  cto_a uuid := gen_random_uuid();
  path_a text;
  visible int;
BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS Expediente A'), (org_b, 'RLS Expediente B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, admin_a, 'admin_org'),
    (org_a, viewer_a, 'customer_service');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (admin_a, 'admin_org'),
    (viewer_a, 'customer_service'),
    (super_u, 'super_admin');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cliente EXP A', 'XAXX010101E00', 'expa@test.local', org_a),
    (cli_b, 'Cliente EXP B', 'XAXX010101E01', 'expb@test.local', org_b);

  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_a, 'Proveedor EXP A', org_a, 'Nacional', 'General');

  INSERT INTO public.cliente_documentos
    (id, organization_id, cliente_id, tipo, nombre, archivo) VALUES
    (doc_a, org_a, cli_a, 'Constancia de situación fiscal', 'CSF',
     'clientes/' || cli_a::text || '/csf.pdf');

  INSERT INTO public.proveedor_contactos
    (id, organization_id, proveedor_id, nombre, area) VALUES
    (cto_a, org_a, prov_a, 'Contacto EXP', 'Operaciones');

  -- ── 1. viewer NO puede escribir en cliente_documentos ────────────────────
  PERFORM pg_temp.as_user(viewer_a);

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.cliente_documentos (organization_id, cliente_id, tipo, nombre, archivo) VALUES (%L, %L, %L, %L, %L)',
      org_a, cli_a, 'Otro', 'Intruso', 'clientes/' || cli_a::text || '/intruso.pdf'
    ),
    'viewer NO debe poder INSERT en cliente_documentos'
  );

  UPDATE public.cliente_documentos SET notas = 'hackeado' WHERE id = doc_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.cliente_documentos
   WHERE id = doc_a AND notas = 'hackeado';
  PERFORM pg_temp.assert(visible = 0, 'viewer NO debe poder UPDATE cliente_documentos (la fila quedó modificada)');

  PERFORM pg_temp.as_user(viewer_a);
  DELETE FROM public.cliente_documentos WHERE id = doc_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.cliente_documentos WHERE id = doc_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer NO debe poder DELETE cliente_documentos (la fila desapareció)');

  -- ── 2. viewer NO puede escribir en proveedor_contactos ───────────────────
  PERFORM pg_temp.as_user(viewer_a);
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.proveedor_contactos (organization_id, proveedor_id, nombre, area) VALUES (%L, %L, %L, %L)',
      org_a, prov_a, 'Intruso', 'Otro'
    ),
    'viewer NO debe poder INSERT en proveedor_contactos'
  );
  DELETE FROM public.proveedor_contactos WHERE id = cto_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.proveedor_contactos WHERE id = cto_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer NO debe poder DELETE proveedor_contactos');

  -- ── 3. Lectura org-scoped intacta ────────────────────────────────────────
  PERFORM pg_temp.as_user(viewer_a);
  SELECT count(*) INTO visible FROM public.cliente_documentos WHERE id = doc_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer SÍ debe leer los documentos de su org (lectura org-scoped intacta)');
  SELECT count(*) INTO visible FROM public.cliente_documentos WHERE cliente_id = cli_b;
  PERFORM pg_temp.assert(visible = 0, 'viewer NO debe leer documentos de otra org');

  -- ── 4. Bypass super_admin de lectura intacto ─────────────────────────────
  PERFORM pg_temp.as_user(super_u);
  SELECT count(*) INTO visible FROM public.cliente_documentos WHERE id = doc_a;
  PERFORM pg_temp.assert(visible = 1, 'super_admin SÍ debe leer documentos de cualquier org (bypass intacto)');
  PERFORM pg_temp.as_postgres();

  -- ── 5. admin_org SÍ puede INSERT/DELETE (control positivo) ───────────────
  PERFORM pg_temp.as_user(admin_a);
  INSERT INTO public.cliente_documentos (organization_id, cliente_id, tipo, nombre, archivo)
  VALUES (org_a, cli_a, 'Otro', 'Control admin', 'clientes/' || cli_a::text || '/control.pdf');
  DELETE FROM public.cliente_documentos WHERE nombre = 'Control admin' AND organization_id = org_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.cliente_documentos
   WHERE nombre = 'Control admin' AND organization_id = org_a;
  PERFORM pg_temp.assert(visible = 0, 'admin_org SÍ debe poder INSERT y DELETE en cliente_documentos (control)');

  -- ── 6. Storage clientes/: viewer bloqueado, admin permitido ──────────────
  -- El stub de storage lo carga _ci_bootstrap.sql; si el entorno no tiene
  -- policies en storage.objects, se saltan los casos 6 y 7.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
             AND policyname='Cliente docs upload') THEN
    INSERT INTO storage.buckets(id, name, public) VALUES ('documentos', 'documentos', false)
    ON CONFLICT DO NOTHING;

    path_a := 'clientes/' || cli_a::text || '/csf.pdf';
    INSERT INTO storage.objects(bucket_id, name, owner) VALUES ('documentos', path_a, admin_a);

    -- viewer NO puede subir a la carpeta del cliente
    PERFORM pg_temp.as_user(viewer_a);
    PERFORM pg_temp.assert_insert_blocked(
      format(
        'INSERT INTO storage.objects(bucket_id, name, owner) VALUES (%L, %L, %L)',
        'documentos', 'clientes/' || cli_a::text || '/intruso.pdf', viewer_a
      ),
      'viewer NO debe poder INSERT en storage clientes/'
    );

    -- viewer NO puede borrar el objeto (DELETE RLS = 0 filas, sin error)
    DELETE FROM storage.objects WHERE bucket_id = 'documentos' AND name = path_a;
    PERFORM pg_temp.as_postgres();
    SELECT count(*) INTO visible FROM storage.objects WHERE bucket_id = 'documentos' AND name = path_a;
    PERFORM pg_temp.assert(visible = 1, 'viewer NO debe poder DELETE en storage clientes/');

    -- viewer SÍ lee el objeto mientras el documento está vivo
    PERFORM pg_temp.as_user(viewer_a);
    SELECT count(*) INTO visible FROM storage.objects WHERE bucket_id = 'documentos' AND name = path_a;
    PERFORM pg_temp.assert(visible = 1, 'viewer SÍ debe leer el objeto ligado a un documento vivo de su org');

    -- admin SÍ puede subir (control positivo)
    PERFORM pg_temp.as_user(admin_a);
    INSERT INTO storage.objects(bucket_id, name, owner)
    VALUES ('documentos', 'clientes/' || cli_a::text || '/control.pdf', admin_a);
    PERFORM pg_temp.as_postgres();

    -- ── 7. deleted_at IS NULL intacto en la lectura de storage ─────────────
    UPDATE public.cliente_documentos SET deleted_at = now() WHERE id = doc_a;
    PERFORM pg_temp.as_user(viewer_a);
    SELECT count(*) INTO visible FROM storage.objects WHERE bucket_id = 'documentos' AND name = path_a;
    PERFORM pg_temp.assert(visible = 0, 'Tras baja lógica del documento, "Cliente docs read" debe dejar de mostrar el objeto (deleted_at IS NULL intacto)');
    PERFORM pg_temp.as_postgres();
  ELSE
    RAISE NOTICE 'storage.objects sin policies de cliente en este entorno — casos 6 y 7 saltados';
  END IF;

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'RLS EXPEDIENTE CLIENTE: todas las aserciones pasaron';
END;
$$;

ROLLBACK;
