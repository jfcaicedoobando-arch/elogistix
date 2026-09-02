-- =============================================================
-- buzon_localizar_duplicado_org_scope.sql · OLA P2-1
--
-- `buzon_localizar_duplicado` es SECURITY DEFINER y decide si expone
-- factura_id/embarque_id/folio de un duplicado. Este test cubre una
-- relación CORRUPTA cross-org (documento del buzón de la Org A cuya
-- `proveedor_factura_id` apunta a una factura de la Org B, y por separado
-- una factura cuyo `embarque_id` apunta a un embarque de otra org): en
-- ambos casos debe devolver 'ajeno' sin ids ni folio, nunca los datos de
-- la organización ajena.
--
-- Corre en CI como paso del workflow rls-tests.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/buzon_localizar_duplicado_org_scope.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org_a uuid := '11111111-aaaa-1111-1111-111111111111';
  v_org_b uuid := '22222222-bbbb-2222-2222-222222222222';
  v_uid_a uuid := gen_random_uuid();
  v_cli_a uuid;
  v_cli_b uuid;
  v_emb_a uuid;
  v_emb_b uuid;
  v_cat_a uuid;
  v_cat_b uuid;
  v_prov_a uuid;
  v_prov_b uuid;
  v_fact_b uuid;      -- factura VIVA de la org B
  v_fact_a_huerfana uuid; -- factura de la org A con embarque_id de la org B
  v_doc_a uuid;        -- documento del buzón de la org A que apunta a v_fact_b
BEGIN
  INSERT INTO public.organizations (id, nombre, rfc, plan, activo)
  VALUES (v_org_a, 'TEST ORG A DEDUPE', 'TOA000000XX0', 'basico', true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations (id, nombre, rfc, plan, activo)
  VALUES (v_org_b, 'TEST ORG B DEDUPE', 'TOB000000XX0', 'basico', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid_a, 'dedupe-org-a@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_a, v_uid_a, 'admin_org') ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org_a, 'CLIENTE DEDUPE A', '', 'dedupe-a@test.mx') RETURNING id INTO v_cli_a;
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org_b, 'CLIENTE DEDUPE B', '', 'dedupe-b@test.mx') RETURNING id INTO v_cli_b;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org_a, v_cli_a, 'ELDDA9001', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb_a;
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org_b, v_cli_b, 'ELDDB9001', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb_b;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_org_a, 'Test Dedupe A', 0, true, 'CostoDirectoEmbarque') RETURNING id INTO v_cat_a;
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_org_b, 'Test Dedupe B', 0, true, 'CostoDirectoEmbarque') RETURNING id INTO v_cat_b;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org_a, 'PROVEEDOR DEDUPE A', 'Logistico'::public.categoria_proveedor, 'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov_a;
  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org_b, 'PROVEEDOR DEDUPE B', 'Logistico'::public.categoria_proveedor, 'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov_b;

  -- Factura VIVA de la org B, capturada y vinculada a su propio embarque.
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org_b, v_prov_b, 'DEDUPE-B-01', v_cat_b, 'FP-DEDUPE-B', v_emb_b, 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_fact_b;

  -- CASO CORRUPTO #1: documento CAPTURADO del buzón de la org A cuyo
  -- `proveedor_factura_id` quedó apuntando (por corrupción/migración mala) a
  -- la factura VIVA de la org B.
  INSERT INTO public.embarque_facturas_entrantes (
    organization_id, embarque_id, archivo_path, archivo_hash, nombre_archivo,
    estado, proveedor_factura_id, uuid_fiscal
  ) VALUES (
    v_org_a, v_emb_a, 'org-a/doc-corrupto.pdf', 'hashcorruptoab12', 'doc-corrupto.pdf',
    'capturada', v_fact_b, 'UUID-CORRUPTO-0001'
  ) RETURNING id INTO v_doc_a;

  -- CASO CORRUPTO #2: factura de la org A cuyo `embarque_id` quedó apuntando
  -- al embarque de la org B (para probarlo aislado, sin documento del buzón,
  -- usamos un UUID fiscal propio).
  -- El guard `_assert_padre_misma_org` impide crear esta corrupción por vías
  -- normales; se desactiva sólo para SEMBRAR el caso histórico que la RPC debe
  -- seguir cubriendo.
  ALTER TABLE public.proveedor_facturas DISABLE TRIGGER trg_org_proveedor_facturas_embarque_id;
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion,
    uuid_fiscal
  ) VALUES (
    v_org_a, v_prov_a, 'DEDUPE-A-02', v_cat_a, 'FP-DEDUPE-A2', v_emb_b, 500, 500,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada',
    'UUID-CORRUPTO-0002'
  ) RETURNING id INTO v_fact_a_huerfana;
  ALTER TABLE public.proveedor_facturas ENABLE TRIGGER trg_org_proveedor_facturas_embarque_id;
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: hash del documento corrupto (org A) → 'ajeno' sin ids, aunque el
-- documento raíz SÍ es visible para la org A (el corrupto es el segundo salto).
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_uid_a uuid;
  v_caso text;
  v_fac_id uuid;
  v_emb_id uuid;
BEGIN
  SELECT id INTO v_uid_a FROM auth.users WHERE email = 'dedupe-org-a@test.mx';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_a)::text, true);

  SELECT caso, factura_id, embarque_id INTO v_caso, v_fac_id, v_emb_id
    FROM public.buzon_localizar_duplicado('hashcorruptoab12', 'archivo_hash', NULL, NULL);

  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_caso IS DISTINCT FROM 'ajeno' OR v_fac_id IS NOT NULL OR v_emb_id IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: esperaba ajeno sin ids, obtuvo caso=% factura_id=% embarque_id=%',
      v_caso, v_fac_id, v_emb_id;
  END IF;
  RAISE NOTICE 'CASO 1 OK: proveedor_factura_id cross-org corrupto → ajeno sin ids';
END
$caso1$;

-- -------------------------------------------------------------
-- CASO 2: UUID fiscal de la factura de la org A cuyo embarque_id apunta a
-- la org B → 'ajeno' sin ids (nunca se expone el embarque de la org B).
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_uid_a uuid;
  v_caso text;
  v_fac_id uuid;
  v_emb_id uuid;
BEGIN
  SELECT id INTO v_uid_a FROM auth.users WHERE email = 'dedupe-org-a@test.mx';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_a)::text, true);

  SELECT caso, factura_id, embarque_id INTO v_caso, v_fac_id, v_emb_id
    FROM public.buzon_localizar_duplicado(NULL, 'archivo_hash', 'UUID-CORRUPTO-0002', NULL);

  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_caso IS DISTINCT FROM 'ajeno' OR v_fac_id IS NOT NULL OR v_emb_id IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: esperaba ajeno sin ids, obtuvo caso=% factura_id=% embarque_id=%',
      v_caso, v_fac_id, v_emb_id;
  END IF;
  RAISE NOTICE 'CASO 2 OK: proveedor_facturas.embarque_id cross-org corrupto → ajeno sin ids';
END
$caso2$;

-- -------------------------------------------------------------
-- CASO 3 (control): el UUID fiscal existe en la org A. Los índices únicos de
-- uuid_fiscal son globales, así que la org B SÍ debe enterarse de que está
-- ocupado ('ajeno'), pero SIN ids ni folio de la otra organización.
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_uid_b uuid := gen_random_uuid();
  v_org_b uuid := '22222222-bbbb-2222-2222-222222222222';
  v_caso text;
  v_fac_id uuid;
  v_emb_id uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_uid_b, 'dedupe-org-b@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_b, v_uid_b, 'admin_org') ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_b)::text, true);

  SELECT caso, factura_id, embarque_id INTO v_caso, v_fac_id, v_emb_id
    FROM public.buzon_localizar_duplicado(NULL, 'archivo_hash', 'UUID-CORRUPTO-0001', NULL);

  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_caso IS DISTINCT FROM 'ajeno' OR v_fac_id IS NOT NULL OR v_emb_id IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: esperaba ajeno sin ids, obtuvo caso=% factura_id=% embarque_id=%',
      v_caso, v_fac_id, v_emb_id;
  END IF;
  RAISE NOTICE 'CASO 3 OK: duplicado de otra org se reporta como ajeno sin filtrar ids';
END
$caso3$;

ROLLBACK;
