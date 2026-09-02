-- =============================================================
-- cxc_guard_nc_multimoneda.sql · Ola G1 (auditoría 2026-08-19)
--
-- Test conductual de `public.assert_nc_no_excede_saldo`: las notas de
-- crédito deben convertirse a la moneda de la factura antes de
-- compararse contra el saldo pendiente.
--   Caso 1: factura USD 1,000 (TC 17) + NC MXN 5,000 → PERMITIDA
--           (5,000 MXN ≈ 294 USD, muy por debajo del saldo).
--   Caso 2: factura USD 1,000 (TC 17) + NC MXN 100,000 → LC_NC_EXCEDE_SALDO
--           (100,000 MXN ≈ 5,882 USD, excede el saldo).
--
-- Antes del FIX el caso 1 fallaba (5,000 > 1,000 en crudo) y el caso 2
-- también, ambos por comparar pesos contra dólares.
--
-- Fixture en BEGIN…ROLLBACK: no ensucia el snapshot.
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxc_guard_nc_multimoneda.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_cli uuid := '22222222-2222-2222-2222-222222222222';
  v_fac uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org NC Multimoneda') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli NC Multimoneda', 'XAXX010101000', 'nc@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- El T/C de la factura lo impone el DOF de su fecha de emisión, así que el
  -- fixture siembra el DOF con el mismo 17 que asumen los casos (se revierte).
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE - 5, 17, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 17;

  -- Factura USD 1,000 con TC 17.
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
     subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli NC Multimoneda', 'NC-MM-001',
     CURRENT_DATE - 5, CURRENT_DATE + 25, 'USD'::public.moneda, 17,
     1000, 0, 1000, 'Emitida'::public.estado_factura);
END
$fixture$;

-- Caso 1: NC en MXN pequeña respecto al saldo en USD → debe permitirse.
DO $caso1$
BEGIN
  INSERT INTO public.factura_notas_credito
    (id, organization_id, factura_id, folio, monto, moneda, tipo_cambio,
     fecha_emision, estado, uuid_fiscal)
  VALUES
    ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333', 'NC-MM-T1', 5000, 'MXN'::public.moneda, 1,
     CURRENT_DATE, 'Aplicada'::public.estado_nota_credito, gen_random_uuid()::text);
  RAISE NOTICE 'CASO 1 OK: NC MXN 5,000 aceptada contra saldo USD 1,000 (TC 17)';
END
$caso1$;

-- Caso 2: NC en MXN que excede el saldo convertido → LC_NC_EXCEDE_SALDO.
DO $caso2$
BEGIN
  BEGIN
    INSERT INTO public.factura_notas_credito
      (id, organization_id, factura_id, folio, monto, moneda, tipo_cambio,
       fecha_emision, estado, uuid_fiscal)
    VALUES
      ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111',
       '33333333-3333-3333-3333-333333333333', 'NC-MM-T2', 100000, 'MXN'::public.moneda, 1,
       CURRENT_DATE, 'Aplicada'::public.estado_nota_credito, gen_random_uuid()::text);
    RAISE EXCEPTION 'CASO 2 FALLÓ: se aceptó una NC de MXN 100,000 sobre un saldo de USD 1,000';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%LC_NC_EXCEDE_SALDO%' THEN
        RAISE EXCEPTION 'CASO 2 FALLÓ: error inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'CASO 2 OK: LC_NC_EXCEDE_SALDO al exceder el saldo convertido';
  END;
END
$caso2$;

ROLLBACK;
