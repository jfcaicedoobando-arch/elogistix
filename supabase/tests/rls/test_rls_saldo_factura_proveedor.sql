-- ============================================================================
-- Suite RLS — org guard en public.saldo_factura_proveedor (Ola 13 · S07, R4BD-02)
-- ============================================================================
-- Verifica la re-emisión de 20260824070000_ola13_org_guard_saldo.sql:
--   T1. Cross-tenant cerrado: usuario de org A con UUID de factura de org B → NULL.
--   T2. Traza numérica intacta: USD 10,000 + pago MXN 86,000 @17.20 → saldo 5,000.00.
--   T3. Pago sin tipo de cambio → pagado 0, saldo 10,000.00, flujo_incompleto=true.
--   T4. Factura Cancelada → NULL (sin saldo exigible).
--   T5. Sin contexto de organización → 42501 'LC_ORG_SIN_CONTEXTO'.
--   T6. Matriz de grants H6 intacta (authenticated/service_role sí; PUBLIC/anon no).
--   T7. Canónicas hermanas (a_mxn, monto_pago_en_moneda_factura) sin alterar.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_saldo_factura_proveedor.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();   -- miembro sólo de org A
  user_b uuid := gen_random_uuid();   -- miembro sólo de org B
  prov_b uuid := gen_random_uuid();
  cat_b uuid := gen_random_uuid();   -- categoría de presupuesto (NOT NULL en proveedor_facturas)
  fac_b uuid := gen_random_uuid();        -- USD 10,000, pago con TC
  fac_b_sintc uuid := gen_random_uuid();  -- USD 10,000, pago sin TC
  fac_b_cancel uuid := gen_random_uuid(); -- USD 10,000, Cancelada
  v_res jsonb;
  v_err text;
BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS Saldo Prov A'), (org_b, 'RLS Saldo Prov B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'),
    (org_b, user_b, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_b, 'Proveedor Saldo B', org_b, 'Agente Aduanal', 'Logistico');

  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES
    (cat_b, org_b, 'S07 Fletes');

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id, moneda, subtotal, iva, total, estado) VALUES
    (fac_b, org_b, prov_b, 'Proveedor Saldo B', 'S07-F1', cat_b, 'USD', 10000, 0, 10000, 'Vigente'),
    (fac_b_sintc, org_b, prov_b, 'Proveedor Saldo B', 'S07-F2', cat_b, 'USD', 10000, 0, 10000, 'Vigente'),
    (fac_b_cancel, org_b, prov_b, 'Proveedor Saldo B', 'S07-F3', cat_b, 'USD', 10000, 0, 10000, 'Cancelada');

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd) VALUES
    (org_b, fac_b, 86000, 'MXN', 17.20),
    (org_b, fac_b_sintc, 86000, 'MXN', 0);

  -- ── T1 · cross-tenant → NULL ─────────────────────────────────────────────
  PERFORM pg_temp.as_user(user_a);
  v_res := public.saldo_factura_proveedor(fac_b);
  PERFORM pg_temp.assert(v_res IS NULL,
    'T1: usuario de org A NO debe leer el saldo de una factura de org B');

  -- ── T2 · traza numérica con TC ───────────────────────────────────────────
  PERFORM pg_temp.as_user(user_b);
  v_res := public.saldo_factura_proveedor(fac_b);
  PERFORM pg_temp.assert(v_res IS NOT NULL
    AND (v_res->>'moneda') = 'USD'
    AND (v_res->>'total')::numeric = 10000
    AND (v_res->>'pagado')::numeric = 5000.00
    AND (v_res->>'nc_aplicada')::numeric = 0
    AND (v_res->>'saldo')::numeric = 5000.00
    AND (v_res->>'flujo_incompleto')::boolean = false,
    'T2: USD 10,000 + MXN 86,000 @17.20 debe dar saldo 5,000.00 → ' || COALESCE(v_res::text, 'NULL'));

  -- ── T3 · pago sin tipo de cambio ─────────────────────────────────────────
  v_res := public.saldo_factura_proveedor(fac_b_sintc);
  PERFORM pg_temp.assert(v_res IS NOT NULL
    AND (v_res->>'pagado')::numeric = 0
    AND (v_res->>'saldo')::numeric = 10000.00
    AND (v_res->>'flujo_incompleto')::boolean = true,
    'T3: sin TC debe dar pagado 0, saldo 10,000.00 y flujo_incompleto=true → ' || COALESCE(v_res::text, 'NULL'));

  -- ── T4 · factura cancelada → NULL ────────────────────────────────────────
  v_res := public.saldo_factura_proveedor(fac_b_cancel);
  PERFORM pg_temp.assert(v_res IS NULL, 'T4: una factura Cancelada no debe devolver saldo');

  -- ── T5 · sin contexto de organización → 42501 ────────────────────────────
  PERFORM pg_temp.as_user(gen_random_uuid());
  BEGIN
    v_res := public.saldo_factura_proveedor(fac_b);
    PERFORM pg_temp.assert(false,
      'T5: sin organización activa debe abortar, devolvió ' || COALESCE(v_res::text, 'NULL'));
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_err LIKE 'LC_ORG_SIN_CONTEXTO%',
      'T5: mensaje inesperado → ' || v_err);
  END;

  PERFORM pg_temp.as_postgres();

  -- ── T6 · grants H6 ───────────────────────────────────────────────────────
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated', 'public.saldo_factura_proveedor(uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.saldo_factura_proveedor(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.saldo_factura_proveedor(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('PUBLIC', 'public.saldo_factura_proveedor(uuid)', 'EXECUTE'),
    'T6: la matriz de grants H6 de saldo_factura_proveedor cambió');

  -- ── T7 · canónicas hermanas sin alterar ──────────────────────────────────
  PERFORM pg_temp.assert(
    public.monto_pago_en_moneda_factura(86000, 'MXN', 17.20, 'USD') = 5000.0000
    AND public.monto_pago_en_moneda_factura(86000, 'MXN', 0, 'USD') IS NULL
    AND public.monto_pago_en_moneda_factura(100, 'USD', 17.20, 'MXN') = 1720.0000
    AND public.a_mxn(100, 'USD', 17.20, NULL) = 1720.0000
    AND public.a_mxn(100, 'EUR', NULL, NULL) IS NULL,
    'T7: a_mxn / monto_pago_en_moneda_factura fueron alteradas');

  RAISE NOTICE 'RLS SALDO FACTURA PROVEEDOR: todas las aserciones pasaron';
END $$;

ROLLBACK;
