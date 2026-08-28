-- =============================================================
-- fix3_bug18_alta_inicial.sql · FIX3 tanda 3 (M-6/H2 + M-7/H4)
--
-- Extensión de la verificación server-side (O5.8) al ALTA INICIAL del
-- buzón CxP:
--   · CASO 1: INSERT con JWT de cliente (authenticated) que intenta
--     sembrar metadatos_verificados = true → el trigger lo fuerza a false
--     (los metadatos del navegador NUNCA quedan verificados).
--   · CASO 2: UPDATE con JWT de cliente sobre la fila → sigue sin poder
--     sellar la verificación.
--   · CASO 3: adjuntar_xml_entrante_verificado (la vía de la edge, que
--     re-parsea server-side) escribe los metadatos y sella
--     metadatos_verificados = true.
--   · CASO 4 (M-7): la RPC vieja adjuntar_xml_factura_entrante sigue SIN
--     EXECUTE para authenticated/anon (el espejo canónico conservaba el
--     GRANT y una re-aplicación reabría BUG-18), y la verificada sólo la
--     tiene service_role.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_bug18_alta_inicial.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'bb8bb8bb-0000-4000-8000-000000000010';
  v_cli uuid := 'bb8bb8bb-0000-4000-8000-000000000011';
  v_emb uuid := 'bb8bb8bb-0000-4000-8000-000000000020';
  v_actor uuid := 'bb8bb8bb-0000-4000-8000-000000000021';
  v_doc uuid := 'bb8bb8bb-0000-4000-8000-000000000030';
  v_verif boolean;
  v_uuid text;
  v_sin_permiso text[];
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST FIX3 BUG18');
  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES (v_cli, v_org, 'Cliente FIX3', 'fix3-bug18@test.mx');
  INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo)
  VALUES (v_emb, v_org, v_cli, 'Marítimo', 'Importación');
  -- Actor de plataforma: super_admin es el único rol global no deprecado que
  -- satisface la policy de INSERT del buzón (admin/operador/super_admin;
  -- 'admin' y 'operador' están bloqueados por LC_ROL_LEGACY_BLOQUEADO) y la
  -- lista de roles permitidos de la RPC verificada.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_actor, 'coordinador_logistico');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_actor, 'super_admin')
  ON CONFLICT DO NOTHING;

  -- ----------------------------------------------------------
  -- CASO 1: el alta inicial con JWT de cliente no puede sellar
  -- metadatos_verificados aunque lo pida explícitamente.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_actor);
  INSERT INTO public.embarque_facturas_entrantes (
    id, organization_id, embarque_id, archivo_path, archivo_hash, nombre_archivo,
    xml_path, xml_nombre, xml_hash,
    uuid_fiscal, rfc_emisor, folio_serie, total_detectado, moneda_detectada,
    metadatos_verificados, subido_por
  ) VALUES (
    v_doc, v_org, v_emb, 'org/doc/factura.xml', repeat('a', 64), 'factura.xml',
    'org/doc/factura.xml', 'factura.xml', repeat('a', 64),
    'bb8bb8bb-0000-4000-8000-0000000000aa', 'AAA010101AAA', 'F-1', 1000, 'MXN',
    true, v_actor
  );
  PERFORM pg_temp.as_postgres();

  SELECT metadatos_verificados INTO v_verif
    FROM public.embarque_facturas_entrantes WHERE id = v_doc;
  PERFORM pg_temp.assert(v_verif = false,
    'CASO 1: un INSERT con JWT de cliente logró sellar metadatos_verificados=true');
  RAISE NOTICE 'CASO 1 OK · el INSERT del cliente queda con metadatos NO verificados.';

  -- ----------------------------------------------------------
  -- CASO 2: tampoco por UPDATE con JWT de cliente.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_actor);
  UPDATE public.embarque_facturas_entrantes
     SET metadatos_verificados = true, nota = 'reintento'
   WHERE id = v_doc;
  PERFORM pg_temp.as_postgres();

  SELECT metadatos_verificados INTO v_verif
    FROM public.embarque_facturas_entrantes WHERE id = v_doc;
  PERFORM pg_temp.assert(v_verif = false,
    'CASO 2: un UPDATE con JWT de cliente logró sellar metadatos_verificados=true');
  RAISE NOTICE 'CASO 2 OK · el UPDATE del cliente tampoco sella la verificación.';

  -- ----------------------------------------------------------
  -- CASO 3: la vía verificada (edge → RPC service_role) escribe los
  -- metadatos del servidor y sella metadatos_verificados = true.
  -- ----------------------------------------------------------
  PERFORM public.adjuntar_xml_entrante_verificado(
    v_doc, v_actor,
    'org/doc/factura.xml', 'factura.xml', repeat('a', 64),
    'bb8bb8bb-0000-4000-8000-0000000000bb', 'BBB020202BBB', 'F-9',
    CURRENT_DATE, 2000, 'MXN'
  );

  SELECT metadatos_verificados, uuid_fiscal INTO v_verif, v_uuid
    FROM public.embarque_facturas_entrantes WHERE id = v_doc;
  PERFORM pg_temp.assert(v_verif = true,
    'CASO 3: la RPC verificada no selló metadatos_verificados');
  -- trg_efe_normalizar_uuid_fiscal guarda el UUID en mayúsculas (estilo SAT).
  PERFORM pg_temp.assert(lower(v_uuid) = lower('bb8bb8bb-0000-4000-8000-0000000000bb'),
    'CASO 3: la RPC verificada no reemplazó los metadatos del cliente por los del servidor');
  RAISE NOTICE 'CASO 3 OK · la vía server-side confirma/reemplaza y sella la verificación.';

  -- ----------------------------------------------------------
  -- CASO 4 (M-7): permisos finales — la RPC vieja sigue fuera de
  -- authenticated/anon y la verificada es exclusiva de service_role.
  -- ----------------------------------------------------------
  SELECT array_agg(p.proname || ' ↔ ' || r.rol ORDER BY p.proname)
    INTO v_sin_permiso
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN (VALUES ('authenticated'), ('anon')) AS r(rol)
  WHERE n.nspname = 'public'
    AND p.proname IN ('adjuntar_xml_factura_entrante', 'adjuntar_xml_entrante_verificado')
    AND has_function_privilege(r.rol, p.oid, 'EXECUTE');

  IF v_sin_permiso IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 4 FAIL: RPCs del buzón ejecutables por roles de cliente: %', v_sin_permiso;
  END IF;

  PERFORM 1
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'adjuntar_xml_entrante_verificado'
     AND has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASO 4 FAIL: service_role perdió EXECUTE en adjuntar_xml_entrante_verificado (la edge lo necesita)';
  END IF;
  RAISE NOTICE 'CASO 4 OK · RPC vieja revocada, verificada exclusiva de service_role.';
END $$;

ROLLBACK;
