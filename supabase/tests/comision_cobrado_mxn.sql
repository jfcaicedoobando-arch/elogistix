-- =============================================================
-- comision_cobrado_mxn.sql · BL-01
--
-- Tests conductuales de `calcular_comision_pago`: la columna
-- `comisiones_devengadas.monto_cobrado_mxn` debe valuar lo cobrado desde
-- la moneda de la FACTURA con el TC del documento, sin importar la moneda
-- del pago ni el factor pago→factura guardado en pagos_factura.tipo_cambio.
--
-- Cubre los 4 cuadrantes moneda-pago × moneda-factura (antes 3 de 4
-- quedaban valuados ~19× mal):
--   1) pago MXN / factura USD  → aplicado(USD) × TC del documento
--   2) pago USD / factura USD  → aplicado(USD) × TC del documento
--   3) pago USD / factura MXN  → aplicado ya en MXN, SIN multiplicar
--   4) pago MXN / factura MXN  → identidad
--
-- El trigger trg_pago_factura_comision_ins dispara el cálculo al INSERT;
-- el test sólo lee la fila resultante. Fixture en BEGIN…ROLLBACK.
-- Corre en CI como paso del workflow rls-tests.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/comision_cobrado_mxn.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_cli uuid := '22222222-2222-2222-2222-222222222222';
  v_e1  uuid := '55555555-5555-5555-5555-555555555551';
  v_e2  uuid := '55555555-5555-5555-5555-555555555552';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org BL01 Cobrado MXN') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli BL01', 'XAXX010101000', 'bl01@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Embarque con TC USD 19 (fallback si el documento no tuviera TC).
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo, tipo_cambio_usd)
  VALUES (v_e1, v_org, 'ELOBL0101', v_cli,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, 19)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo)
  VALUES (v_e2, v_org, 'ELOBL0102', v_cli,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- Q1/Q2: facturas USD con TC del documento 18.0.
  -- El T/C de las facturas lo impone el DOF de su fecha de emisión: el fixture
  -- siembra 18 para hoy, el valor que asumen los cálculos de comisión.
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE, 18, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 18;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-3333333333b1', v_org, v_cli, 'Test Cli', v_e1, 'F-BL01-1',
     CURRENT_DATE, CURRENT_DATE + 30, 'USD'::public.moneda, 18.0, 1000, 0, 1000, 'Emitida'),
    ('33333333-3333-3333-3333-3333333333b2', v_org, v_cli, 'Test Cli', v_e1, 'F-BL01-2',
     CURRENT_DATE, CURRENT_DATE + 30, 'USD'::public.moneda, 18.0, 500, 0, 500, 'Emitida');

  -- Q3/Q4: facturas MXN.
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-3333333333b3', v_org, v_cli, 'Test Cli', v_e2, 'F-BL01-3',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 19500, 0, 19500, 'Emitida'),
    ('33333333-3333-3333-3333-3333333333b4', v_org, v_cli, 'Test Cli', v_e2, 'F-BL01-4',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 5000, 0, 5000, 'Emitida');
END
$fixture$ LANGUAGE plpgsql;

-- Pagos (el trigger calcula la comisión en cada INSERT).
-- Q1: pago 19,000 MXN sobre factura USD; aplicado = 1,000 USD; factor pago→factura = 19.
INSERT INTO public.pagos_factura
  (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
   monto_aplicado_factura, forma_pago, referencia, notas)
VALUES
  ('44444444-4444-4444-4444-4444444444b1',
   '33333333-3333-3333-3333-3333333333b1', '11111111-1111-1111-1111-111111111111',
   CURRENT_DATE, 19000, 'MXN'::public.moneda, 19, 1000, 'Transferencia', 'BL01-Q1', '');
-- Q2: pago 500 USD sobre factura USD; aplicado = 500 USD; factor = 1.
INSERT INTO public.pagos_factura
  (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
   monto_aplicado_factura, forma_pago, referencia, notas)
VALUES
  ('44444444-4444-4444-4444-4444444444b2',
   '33333333-3333-3333-3333-3333333333b2', '11111111-1111-1111-1111-111111111111',
   CURRENT_DATE, 500, 'USD'::public.moneda, 1, 500, 'Transferencia', 'BL01-Q2', '');
-- Q3: pago 1,000 USD sobre factura MXN; aplicado = 19,500 MXN; factor = 19.5.
INSERT INTO public.pagos_factura
  (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
   monto_aplicado_factura, forma_pago, referencia, notas)
VALUES
  ('44444444-4444-4444-4444-4444444444b3',
   '33333333-3333-3333-3333-3333333333b3', '11111111-1111-1111-1111-111111111111',
   CURRENT_DATE, 1000, 'USD'::public.moneda, 19.5, 19500, 'Transferencia', 'BL01-Q3', '');
-- Q4: pago 5,000 MXN sobre factura MXN; aplicado = 5,000; factor = 1.
INSERT INTO public.pagos_factura
  (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
   monto_aplicado_factura, forma_pago, referencia, notas)
VALUES
  ('44444444-4444-4444-4444-4444444444b4',
   '33333333-3333-3333-3333-3333333333b4', '11111111-1111-1111-1111-111111111111',
   CURRENT_DATE, 5000, 'MXN'::public.moneda, 1, 5000, 'Transferencia', 'BL01-Q4', '');

-- -------------------------------------------------------------
-- Verificación de los 4 cuadrantes
-- -------------------------------------------------------------
-- Función temporal de aserción (evita repetir el bloque 4 veces).
CREATE OR REPLACE FUNCTION pg_temp.assert_cobrado(p_pago uuid, p_esperado numeric, p_caso text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_cobrado numeric;
BEGIN
  SELECT monto_cobrado_mxn INTO v_cobrado
    FROM public.comisiones_devengadas WHERE pago_factura_id = p_pago;
  IF v_cobrado IS NULL THEN
    RAISE EXCEPTION '% FALLÓ: no existe fila en comisiones_devengadas', p_caso;
  END IF;
  IF v_cobrado <> p_esperado THEN
    RAISE EXCEPTION '% FALLÓ: monto_cobrado_mxn=% (esperado %)', p_caso, v_cobrado, p_esperado;
  END IF;
  RAISE NOTICE '% OK: monto_cobrado_mxn=%', p_caso, v_cobrado;
END $$;

DO $$
BEGIN
  -- Q1: 1,000 USD aplicados × TC documento 18.0 = 18,000 (antes: 1,000).
  PERFORM pg_temp.assert_cobrado('44444444-4444-4444-4444-4444444444b1', 18000, 'CASO 1 (pago MXN / factura USD)');
  -- Q2: 500 USD × 18.0 = 9,000 (antes: 500).
  PERFORM pg_temp.assert_cobrado('44444444-4444-4444-4444-4444444444b2', 9000, 'CASO 2 (pago USD / factura USD)');
  -- Q3: 19,500 MXN tal cual — el monto_aplicado ya está en MXN y NO debe
  -- multiplicarse por el factor pago→factura (el bug (c) lo inflaba ~19×).
  PERFORM pg_temp.assert_cobrado('44444444-4444-4444-4444-4444444444b3', 19500, 'CASO 3 (pago USD / factura MXN)');
  -- Q4: identidad MXN.
  PERFORM pg_temp.assert_cobrado('44444444-4444-4444-4444-4444444444b4', 5000, 'CASO 4 (pago MXN / factura MXN)');
END $$;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 4 NOTICE "CASO n OK" y ROLLBACK.
-- =============================================================
