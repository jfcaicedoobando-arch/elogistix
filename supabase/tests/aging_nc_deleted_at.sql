-- =============================================================
-- aging_nc_deleted_at.sql · Hotfix (auditoría de tests 2026-07-24)
--
-- Test conductual del H1: `cxp_aging_proveedores` debe ignorar las
-- notas de crédito soft-borradas (deleted_at NOT NULL), en paridad
-- con el guard de sobrepago y la vista canónica
-- `v_proveedor_facturas_saldo`.
--
-- FALLA contra la función vigente pre-FIX (el CTE nc no filtra
-- deleted_at) y PASA tras la migración FIX de este paquete.
--
-- Corre en CI como paso del workflow rls-tests. Fixture en
-- BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/aging_nc_deleted_at.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_uid uuid := '55555555-5555-5555-5555-555555555555';
  v_prov uuid := '22222222-2222-2222-2222-222222222222';
  v_fact uuid := '33333333-3333-3333-3333-333333333333';
  v_cat uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Aging NC') ON CONFLICT (id) DO NOTHING;

  -- Usuario con membresía en la org (aging exige caller con org activa).
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'aging@test.mx')
  ON CONFLICT (id) DO NOTHING;
  -- rol explícito: el default 'viewer' está bloqueado (LC_ROL_LEGACY_BLOQUEADO).
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'customer_service') ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov Aging', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias
    (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Test Aging NC', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
     estado, estado_aprobacion, fecha_emision, fecha_vencimiento)
  VALUES
    (v_fact, v_org, v_prov, 'Test Prov', 'AGING-NC-01', v_cat,
     'MXN'::public.moneda, 0, 3000, 0, 3000, 'Borrador', 'aprobada',
     CURRENT_DATE - 10, CURRENT_DATE + 20);

  -- NC 500 con ciclo de vida completo: Borrador → Aprobada → Aplicada.
  INSERT INTO public.proveedor_notas_credito
    (id, organization_id, proveedor_factura_id, monto, estado, moneda)
  VALUES
    ('77777777-7777-7777-7777-777777777777', v_org, v_fact, 500, 'Borrador', 'MXN');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada'
   WHERE id = '77777777-7777-7777-7777-777777777777';
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada'
   WHERE id = '77777777-7777-7777-7777-777777777777';

  -- Sesión con claims del usuario de la org (como hace pg_temp.as_user).
  PERFORM set_config('request.jwt.claims',
                     jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: NC aplicada viva → saldo aging = 3000 − 500 = 2500
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_saldo numeric;
BEGIN
  SELECT a.saldo_total INTO v_saldo
    FROM public.cxp_aging_proveedores('11111111-1111-1111-1111-111111111111'::uuid) a
   WHERE a.proveedor_id = '22222222-2222-2222-2222-222222222222';
  IF v_saldo IS NULL OR v_saldo <> 2500 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: saldo aging=% (esperado 2500 con NC aplicada)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 1 OK: NC aplicada descuenta en aging (saldo=2500)';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2 (H1): NC soft-borrada → el aging debe volver a 3000
-- (el guard de sobrepago y v_proveedor_facturas_saldo ya lo hacen)
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_saldo numeric; v_saldo_canonico numeric;
BEGIN
  UPDATE public.proveedor_notas_credito SET deleted_at = now()
   WHERE id = '77777777-7777-7777-7777-777777777777';

  SELECT a.saldo_total INTO v_saldo
    FROM public.cxp_aging_proveedores('11111111-1111-1111-1111-111111111111'::uuid) a
   WHERE a.proveedor_id = '22222222-2222-2222-2222-222222222222';
  IF v_saldo IS NULL OR v_saldo <> 3000 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ (H1): saldo aging=% tras soft-delete de la NC (esperado 3000; la NC borrada sigue descontando)', v_saldo;
  END IF;

  -- Paridad con la vista canónica.
  SELECT v.saldo INTO v_saldo_canonico
    FROM public.v_proveedor_facturas_saldo v
   WHERE v.proveedor_factura_id = '33333333-3333-3333-3333-333333333333';
  IF v_saldo_canonico IS DISTINCT FROM v_saldo THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: aging=% diverge de v_proveedor_facturas_saldo=%',
      v_saldo, v_saldo_canonico;
  END IF;
  RAISE NOTICE 'CASO 2 OK: NC soft-borrada ignorada; aging (%) = vista canónica (%)',
    v_saldo, v_saldo_canonico;
END
$caso2$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 2 NOTICE "CASO n OK" y ROLLBACK.
-- Contra la función pre-FIX, el CASO 2 aborta (ésa es la prueba
-- de que el test atrapa el bug H1).
-- =============================================================
