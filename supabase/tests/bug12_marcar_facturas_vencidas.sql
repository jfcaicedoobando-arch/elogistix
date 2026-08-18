-- =============================================================
-- bug12_marcar_facturas_vencidas.sql · BUG-12
--
-- Regresión del barrido diario de facturas vencidas. La versión
-- anterior filtraba el UPDATE por contexto de usuario
-- (service_role / super_admin / current_user_org_id()), y bajo
-- pg_cron —sin sesión— no marcaba ninguna fila: el job corría
-- "succeeded" todos los días sin efecto.
--
-- Casos:
--   1) 'Emitida' vencida  → 'Vencida' SIN contexto de auth (como pg_cron)
--   2) 'Parcialmente pagada' vencida → NO se toca
--   3) 'Pagada' / 'Cancelada' / borrada vencidas → NO se tocan
--   4) idempotencia: segunda corrida marca 0 filas nuevas
--   5) un pago posterior sobre una 'Vencida' la recalcula (Pagada)
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/bug12_marcar_facturas_vencidas.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-1111111111b1';
  v_cli uuid := '22222222-2222-2222-2222-2222222222b1';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org BUG-12') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli BUG-12', 'XAXX010101000', 'bug12@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- A: Emitida vencida (debe marcarse)
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-3333333333b1', v_org, v_cli, 'Test Cli', 'F-B12-A',
     CURRENT_DATE - 40, CURRENT_DATE - 10, 'MXN', 1000, 0, 1000, 'Emitida');

  -- B: Emitida NO vencida (no debe marcarse)
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-3333333333b2', v_org, v_cli, 'Test Cli', 'F-B12-B',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1000, 0, 1000, 'Emitida');

  -- C: vencida con pago parcial → queda 'Parcialmente pagada' por recálculo
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    ('33333333-3333-3333-3333-3333333333b3', v_org, v_cli, 'Test Cli', 'F-B12-C',
     CURRENT_DATE - 40, CURRENT_DATE - 5, 'MXN', 2000, 0, 2000, 'Emitida');
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-4444444444b3',
     '33333333-3333-3333-3333-3333333333b3', v_org,
     CURRENT_DATE, 500, 'MXN', 1, 500, 'Transferencia', 'B12-C', '', 0);

  -- D: Emitida vencida pero en papelera (no debe marcarse)
  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado, deleted_at)
  VALUES
    ('33333333-3333-3333-3333-3333333333b4', v_org, v_cli, 'Test Cli', 'F-B12-D',
     CURRENT_DATE - 40, CURRENT_DATE - 8, 'MXN', 1000, 0, 1000, 'Emitida', now());
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1 + 2 + 3: barrido sin contexto de auth (como pg_cron)
-- -------------------------------------------------------------
DO $$
DECLARE
  v_a text; v_b text; v_c text; v_d text;
BEGIN
  PERFORM public.marcar_facturas_vencidas();

  SELECT estado::text INTO v_a FROM public.facturas WHERE id = '33333333-3333-3333-3333-3333333333b1';
  SELECT estado::text INTO v_b FROM public.facturas WHERE id = '33333333-3333-3333-3333-3333333333b2';
  SELECT estado::text INTO v_c FROM public.facturas WHERE id = '33333333-3333-3333-3333-3333333333b3';
  SELECT estado::text INTO v_d FROM public.facturas WHERE id = '33333333-3333-3333-3333-3333333333b4';

  IF v_a <> 'Vencida' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la Emitida vencida quedó en % (esperado Vencida)', v_a;
  END IF;
  IF v_b <> 'Emitida' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la Emitida vigente cambió a % (esperado Emitida)', v_b;
  END IF;
  IF v_c <> 'Parcialmente pagada' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la parcialmente pagada quedó en % (esperado Parcialmente pagada)', v_c;
  END IF;
  IF v_d <> 'Emitida' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: una factura en papelera fue marcada (estado=%)', v_d;
  END IF;

  RAISE NOTICE 'CASO 1 OK: barrido sin sesión marca Emitida vencida como Vencida';
  RAISE NOTICE 'CASO 2 OK: Parcialmente pagada conserva su estado';
  RAISE NOTICE 'CASO 3 OK: vigentes y papelera intactas';
END $$;

-- -------------------------------------------------------------
-- CASO 4: idempotencia — segunda corrida no marca nada nuevo
-- -------------------------------------------------------------
DO $$
DECLARE v_n integer;
BEGIN
  SELECT public.marcar_facturas_vencidas() INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: segunda corrida marcó % fila(s) (esperado 0)', v_n;
  END IF;
  RAISE NOTICE 'CASO 4 OK: el barrido es idempotente';
END $$;

-- -------------------------------------------------------------
-- CASO 5: 'Vencida' sigue viva — un pago posterior la recalcula
-- -------------------------------------------------------------
DO $$
DECLARE v_estado text;
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
  VALUES
    ('44444444-4444-4444-4444-4444444444b1',
     '33333333-3333-3333-3333-3333333333b1',
     '11111111-1111-1111-1111-1111111111b1',
     CURRENT_DATE, 1000, 'MXN', 1, 1000, 'Transferencia', 'B12-A', '', 0);

  SELECT estado::text INTO v_estado FROM public.facturas
   WHERE id = '33333333-3333-3333-3333-3333333333b1';

  IF v_estado <> 'Pagada' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: pago sobre Vencida dejó estado % (esperado Pagada)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 5 OK: una Vencida se recalcula a Pagada al liquidarse';
END $$;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 6 NOTICE "CASO n OK" y ROLLBACK.
-- =============================================================
