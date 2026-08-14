-- ============================================================================
-- Suite RLS/BD — paginación inversa de proveedor_estado_cuenta_movimientos
-- (Ola 13 · S08, cierra el hueco de pruebas de R4BD-05)
-- ============================================================================
-- Verifica la migración 20260824040000_ola13_r4bd05_p_offset_desde_el_final.sql:
--   T1. Página 1 (p_offset=0) devuelve los movimientos MÁS RECIENTES.
--   T2. Página 2 (p_offset=p_limite) devuelve los ANTERIORES, sin traslape.
--   T3. Páginas 1+2+3 cubren el universo completo: ningún movimiento perdido.
--   T4. 'hay_mas' es false sólo cuando la ventana ya llegó al inicio.
--   T5. Cross-tenant: usuario de org A no ve movimientos del proveedor de org B.
--   T6. Matriz de grants H6 intacta.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_proveedor_estado_cuenta_offset.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  cat_b  uuid := gen_random_uuid();
  v_res    jsonb;
  v_p1     text[];
  v_p2     text[];
  v_p3     text[];
  v_todos  text[];
BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS Offset A'), (org_b, 'RLS Offset B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_b, 'Proveedor Offset B', org_b, 'Agente Aduanal', 'Logistico');

  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES
    (cat_b, org_b, 'S08 Fletes');

  -- 5 facturas MXN, una por mes, folios F1..F5 en orden cronológico.
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id, moneda, subtotal, iva, total, estado,
     estado_aprobacion, fecha_emision)
  SELECT org_b, prov_b, 'Proveedor Offset B', 'S08-F' || i, cat_b, 'MXN',
         1000 * i, 0, 1000 * i, 'Vigente', 'aprobada',
         make_date(2026, i, 10)
  FROM generate_series(1, 5) AS g(i);

  PERFORM pg_temp.as_user(user_b);

  -- ── T1 · página 1 = los 2 más recientes ──────────────────────────────────
  v_res := public.proveedor_estado_cuenta_movimientos(prov_b, NULL, NULL, 2, 0);
  SELECT array_agg(m->>'folio' ORDER BY m->>'fecha')
  INTO v_p1 FROM jsonb_array_elements(v_res->'movimientos') m;
  PERFORM pg_temp.assert((v_res->>'total_movimientos')::int = 5,
    'T1: total_movimientos debe ser 5, fue ' || COALESCE(v_res->>'total_movimientos', 'NULL'));
  PERFORM pg_temp.assert(v_p1 = ARRAY['S08-F4', 'S08-F5'],
    'T1: la página 1 debe traer los más recientes → ' || COALESCE(v_p1::text, 'NULL'));
  PERFORM pg_temp.assert((v_res->>'hay_mas')::boolean,
    'T1: con 5 movimientos y ventana de 2 debe haber más renglones anteriores');

  -- ── T2 · página 2 = los anteriores, sin traslape ──────────────────────────
  v_res := public.proveedor_estado_cuenta_movimientos(prov_b, NULL, NULL, 2, 2);
  SELECT array_agg(m->>'folio' ORDER BY m->>'fecha')
  INTO v_p2 FROM jsonb_array_elements(v_res->'movimientos') m;
  PERFORM pg_temp.assert(v_p2 = ARRAY['S08-F2', 'S08-F3'],
    'T2: la página 2 debe retroceder en el tiempo → ' || COALESCE(v_p2::text, 'NULL'));
  PERFORM pg_temp.assert(NOT (v_p1 && v_p2),
    'T2: las páginas 1 y 2 no deben traslaparse');
  PERFORM pg_temp.assert((v_res->>'hay_mas')::boolean,
    'T2: aún queda 1 movimiento más viejo');

  -- ── T3 · cobertura completa (sin movimientos perdidos) ────────────────────
  v_res := public.proveedor_estado_cuenta_movimientos(prov_b, NULL, NULL, 2, 4);
  SELECT array_agg(m->>'folio' ORDER BY m->>'fecha')
  INTO v_p3 FROM jsonb_array_elements(v_res->'movimientos') m;
  v_todos := v_p1 || v_p2 || v_p3;
  PERFORM pg_temp.assert(
    'S08-F1' = ANY(v_todos) AND 'S08-F2' = ANY(v_todos) AND 'S08-F3' = ANY(v_todos)
    AND 'S08-F4' = ANY(v_todos) AND 'S08-F5' = ANY(v_todos),
    'T3: las 3 páginas deben cubrir los 5 movimientos → ' || COALESCE(v_todos::text, 'NULL'));

  -- ── T4 · 'hay_mas' se apaga al llegar al inicio ───────────────────────────
  PERFORM pg_temp.assert((v_res->>'hay_mas')::boolean = false,
    'T4: en la última página (más antigua) hay_mas debe ser false');
  -- Y con una ventana que abarca todo, tampoco hay más.
  v_res := public.proveedor_estado_cuenta_movimientos(prov_b, NULL, NULL, 100, 0);
  PERFORM pg_temp.assert((v_res->>'hay_mas')::boolean = false
    AND jsonb_array_length(v_res->'movimientos') = 5,
    'T4: con ventana de 100 deben venir los 5 movimientos y hay_mas=false');

  -- ── T5 · cross-tenant: org A no ve nada del proveedor de org B ────────────
  PERFORM pg_temp.as_user(user_a);
  v_res := public.proveedor_estado_cuenta_movimientos(prov_b, NULL, NULL, 100, 0);
  PERFORM pg_temp.assert((v_res->>'total_movimientos')::int = 0
    AND jsonb_array_length(v_res->'movimientos') = 0,
    'T5: un usuario de otra organización no debe ver movimientos ajenos');

  PERFORM pg_temp.as_postgres();

  -- ── T6 · grants H6 ───────────────────────────────────────────────────────
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated',
      'public.proveedor_estado_cuenta_movimientos(uuid,date,date,integer,integer)', 'EXECUTE')
    AND has_function_privilege('service_role',
      'public.proveedor_estado_cuenta_movimientos(uuid,date,date,integer,integer)', 'EXECUTE')
    AND NOT has_function_privilege('anon',
      'public.proveedor_estado_cuenta_movimientos(uuid,date,date,integer,integer)', 'EXECUTE'),
    'T6: la matriz de grants H6 de proveedor_estado_cuenta_movimientos cambió');

  RAISE NOTICE 'RLS PROVEEDOR ESTADO CUENTA OFFSET: todas las aserciones pasaron';
END $$;

ROLLBACK;
