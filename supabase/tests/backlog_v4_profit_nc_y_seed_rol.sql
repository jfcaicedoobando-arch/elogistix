-- =============================================================
-- backlog_v4_profit_nc_y_seed_rol.sql · Backlog v4 (M1 residual + N6 residual)
--
-- M1 residual: profit_por_cliente debe descontar las notas de crédito
--   aplicadas (canon nc_aplicadas_en_moneda_factura) de las facturas activas
--   ligadas al embarque, excluyendo canceladas y en papelera.
-- N6 residual: seed_presupuesto_categorias debe exigir rol administrativo
--   (espejo de la policy presupuesto_categorias_admin_insert) para el caller de
--   la app; el mantenimiento (service_role) sigue permitido.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/backlog_v4_profit_nc_y_seed_rol.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_def text;
BEGIN
  -- M1 residual
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'profit_por_cliente';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'M1-res FAIL: no existe profit_por_cliente';
  END IF;
  IF v_def NOT ILIKE '%nc_aplicadas_en_moneda_factura%' THEN
    RAISE EXCEPTION 'M1-res REGRESIÓN: profit_por_cliente no descuenta notas de crédito (canon ausente)';
  END IF;
  IF v_def NOT ILIKE '%factura_embarques%' THEN
    RAISE EXCEPTION 'M1-res REGRESIÓN: profit_por_cliente no liga las NC por factura_embarques';
  END IF;
  IF v_def NOT ILIKE '%Cancelada%' THEN
    RAISE EXCEPTION 'M1-res REGRESIÓN: profit_por_cliente no excluye facturas canceladas';
  END IF;

  -- N6 residual
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'seed_presupuesto_categorias';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'N6-res FAIL: no existe seed_presupuesto_categorias';
  END IF;
  IF v_def NOT ILIKE '%es_admin_catalogo%' THEN
    RAISE EXCEPTION 'N6-res REGRESIÓN: seed_presupuesto_categorias sin guard de rol administrativo';
  END IF;
  IF v_def NOT ILIKE '%LC_ORG_FORBIDDEN%' THEN
    RAISE EXCEPTION 'N6-res REGRESIÓN: seed_presupuesto_categorias perdió el candado multi-tenant';
  END IF;

  RAISE NOTICE 'Backlog v4 OK · profit_por_cliente neto de NC + seed_presupuesto_categorias con guard de rol.';
END $$;

ROLLBACK;
