-- =============================================================
-- ola1_saldo_nc_multimoneda.sql · Ola 1 remediación (auditoría 3, C1/C1b)
--
-- Contrato: el saldo y el estado de una factura deben restar las notas de
-- crédito CONVERTIDAS a la moneda de la factura, y las tres fuentes de
-- verdad (`saldo_factura_bruto`, `recalcular_estado_factura` y
-- `cartera_pendiente`) deben coincidir.
--
--   Caso: factura MXN 1,160 + NC USD 58 @ TC 20 (= 1,160 MXN)
--         → saldo 0 y estado 'Pagada'; la factura NO debe aparecer en cartera.
--
-- Antes del fix ambas restaban `nc.monto` en crudo (58) → saldo 1,102 y
-- estado 'Emitida' (adeudo fantasma).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola1_saldo_nc_multimoneda.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '1a111111-1111-1111-1111-1111111110a1';
  v_cli uuid := '1a222222-2222-2222-2222-2222222220a1';
  v_fac uuid := '1a333333-3333-3333-3333-3333333330a1';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Ola1 Saldo NC') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Ola1 Saldo NC', 'XAXX010101000', 'ola1@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
     subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli Ola1 Saldo NC', 'OLA1-NC-001',
     CURRENT_DATE - 5, CURRENT_DATE + 25, 'MXN'::public.moneda, 1,
     1000, 160, 1160, 'Emitida'::public.estado_factura);

  INSERT INTO public.factura_notas_credito
    (id, organization_id, factura_id, folio, monto, moneda, tipo_cambio,
     fecha_emision, estado, uuid_fiscal)
  VALUES
    ('1a444444-4444-4444-4444-4444444440a1', v_org, v_fac, 'OLA1-NC-T1',
     58, 'USD'::public.moneda, 20,
     CURRENT_DATE, 'Aplicada'::public.estado_nota_credito, gen_random_uuid()::text);
END
$fixture$;

DO $assert$
DECLARE
  v_fac uuid := '1a333333-3333-3333-3333-3333333330a1';
  v_nc numeric;
  v_saldo numeric;
  v_estado text;
  v_en_cartera int;
BEGIN
  v_nc := public._nc_aplicadas_moneda_factura(v_fac);
  IF abs(v_nc - 1160) > 0.01 THEN
    RAISE EXCEPTION 'OLA1 C1 FALLA: NC convertida esperada 1160, obtenida %', v_nc;
  END IF;

  v_saldo := public.saldo_factura_bruto(v_fac);
  IF abs(v_saldo) > 0.01 THEN
    RAISE EXCEPTION 'OLA1 C1b FALLA: saldo_factura_bruto esperado 0, obtenido %', v_saldo;
  END IF;

  SELECT f.estado::text INTO v_estado FROM public.facturas f WHERE f.id = v_fac;
  IF v_estado <> 'Pagada' THEN
    RAISE EXCEPTION 'OLA1 C1 FALLA: estado esperado Pagada, obtenido %', v_estado;
  END IF;

  SELECT count(*) INTO v_en_cartera
  FROM public.cartera_pendiente() cp WHERE cp.factura_id = v_fac;
  IF v_en_cartera <> 0 THEN
    RAISE EXCEPTION 'OLA1 C1b FALLA: la factura saldada sigue en cartera_pendiente';
  END IF;

  RAISE NOTICE 'OLA1 OK: NC USD convertida (1160 MXN), saldo 0, estado Pagada, fuera de cartera';
END
$assert$;

ROLLBACK;
