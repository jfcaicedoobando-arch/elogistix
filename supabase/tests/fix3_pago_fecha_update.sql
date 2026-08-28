-- =============================================================
-- fix3_pago_fecha_update.sql · FIX3 tanda 3 (M-4 / O1.12 + B3)
--
-- assert_factura_viva_para_pago (migración 20260831100100):
--   · CASO 1 (regresión): INSERT con fecha_pago futura → LC_PAGO_FECHA_FUTURA.
--   · CASO 2: UPDATE de fecha_pago a futura → RECHAZADO (antes se colaba:
--     el guard era sólo INSERT y fecha_pago pasaba por "sólo metadatos").
--   · CASO 3: INSERT con fecha_pago anterior a fecha_emision de la factura
--     → LC_PAGO_FECHA_PREVIA_EMISION (paridad con el lote CxC).
--   · CASO 4: fecha_pago entre emisión y hoy → pasa.
--   · CASO 5 (FIX-63 intacto): UPDATE documental (sin tocar dinero NI
--     fecha) sobre factura Cancelada sigue pasando.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_pago_fecha_update.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

INSERT INTO public.organizations (id, nombre)
VALUES ('ee5ee5ee-0000-4000-8000-000000000010', 'Test FIX3 Fecha Pago');

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('ee5ee5ee-0000-4000-8000-000000000011', 'ee5ee5ee-0000-4000-8000-000000000010', 'Cliente FIX3', 'fix3-pago-fecha@test.mx');

-- Factura emitida HOY (para CASO 1/2/3) y factura emitida hace 10 días (CASO 4).
INSERT INTO public.facturas (id, organization_id, numero, cliente_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('ee5ee5ee-0000-4000-8000-000000000030', 'ee5ee5ee-0000-4000-8000-000000000010', 'FIX3-F1',
        'ee5ee5ee-0000-4000-8000-000000000011', 1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE),
       ('ee5ee5ee-0000-4000-8000-000000000040', 'ee5ee5ee-0000-4000-8000-000000000010', 'FIX3-F2',
        'ee5ee5ee-0000-4000-8000-000000000011', 500, 0, 500, 'MXN', 1, 'Emitida', CURRENT_DATE - 10);

DO $$
BEGIN
  -- CASO 1 (regresión): INSERT futuro rechazado.
  BEGIN
    INSERT INTO public.pagos_factura (factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
    VALUES ('ee5ee5ee-0000-4000-8000-000000000030', 'ee5ee5ee-0000-4000-8000-000000000010',
            CURRENT_DATE + 1, 100, 'MXN', 1, 100);
    RAISE EXCEPTION 'CASO 1 FAIL: INSERT con fecha futura NO fue rechazado';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE 'LC_PAGO_FECHA_FUTURA%' THEN
        RAISE EXCEPTION 'CASO 1 FAIL: se esperaba LC_PAGO_FECHA_FUTURA y vino: %', SQLERRM;
      END IF;
  END;
  RAISE NOTICE 'CASO 1 OK · INSERT con fecha futura rechazado (regresión Ola 1).';

  -- CASO 3: INSERT previo a la emisión rechazado.
  BEGIN
    INSERT INTO public.pagos_factura (factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
    VALUES ('ee5ee5ee-0000-4000-8000-000000000030', 'ee5ee5ee-0000-4000-8000-000000000010',
            CURRENT_DATE - 1, 100, 'MXN', 1, 100);
    RAISE EXCEPTION 'CASO 3 FAIL: INSERT con fecha previa a la emisión NO fue rechazado';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE 'LC_PAGO_FECHA_PREVIA_EMISION%' THEN
        RAISE EXCEPTION 'CASO 3 FAIL: se esperaba LC_PAGO_FECHA_PREVIA_EMISION y vino: %', SQLERRM;
      END IF;
  END;
  RAISE NOTICE 'CASO 3 OK · cobro previo a la emisión rechazado (paridad con lote CxC).';
END $$;

-- Pago válido base para los CASO 2 y 5 (hoy == emisión).
INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('ee5ee5ee-0000-4000-8000-000000000031', 'ee5ee5ee-0000-4000-8000-000000000030',
        'ee5ee5ee-0000-4000-8000-000000000010', CURRENT_DATE, 100, 'MXN', 1, 100);

DO $$
BEGIN
  -- CASO 2: UPDATE de fecha_pago a futura → RECHAZADO (era el bypass B3).
  BEGIN
    UPDATE public.pagos_factura
       SET fecha_pago = CURRENT_DATE + 5
     WHERE id = 'ee5ee5ee-0000-4000-8000-000000000031';
    RAISE EXCEPTION 'CASO 2 FAIL: UPDATE de fecha_pago a futura NO fue rechazado (bypass vigente)';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE 'LC_PAGO_FECHA_FUTURA%' THEN
        RAISE EXCEPTION 'CASO 2 FAIL: se esperaba LC_PAGO_FECHA_FUTURA y vino: %', SQLERRM;
      END IF;
  END;
  RAISE NOTICE 'CASO 2 OK · UPDATE de fecha a futura rechazado (bypass cerrado).';

  -- UPDATE de fecha_pago a previa-emisión también queda cubierto.
  BEGIN
    UPDATE public.pagos_factura
       SET fecha_pago = CURRENT_DATE - 30
     WHERE id = 'ee5ee5ee-0000-4000-8000-000000000031';
    RAISE EXCEPTION 'CASO 2b FAIL: UPDATE de fecha_pago previa a la emisión NO fue rechazado';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE 'LC_PAGO_FECHA_PREVIA_EMISION%' THEN
        RAISE EXCEPTION 'CASO 2b FAIL: se esperaba LC_PAGO_FECHA_PREVIA_EMISION y vino: %', SQLERRM;
      END IF;
  END;
  RAISE NOTICE 'CASO 2b OK · UPDATE de fecha previa a la emisión rechazado.';
END $$;

DO $$
BEGIN
  -- CASO 4: cobro entre emisión (hace 10 días) y hoy → permitido.
  INSERT INTO public.pagos_factura (factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
  VALUES ('ee5ee5ee-0000-4000-8000-000000000040', 'ee5ee5ee-0000-4000-8000-000000000010',
          CURRENT_DATE - 5, 200, 'MXN', 1, 200);
  RAISE NOTICE 'CASO 4 OK · cobro con fecha entre emisión y hoy permitido.';
END $$;

-- CASO 5 (FIX-63 intacto): con la factura cancelada, un UPDATE puramente
-- documental del pago (sin tocar dinero ni fecha) debe pasar.
-- (La cancelación se siembra con replica para no pelear con la máquina de
-- estados de facturas — el flujo real cancela vía Facturapi.)
SET LOCAL session_replication_role = replica;
UPDATE public.facturas
   SET estado = 'Cancelada'
 WHERE id = 'ee5ee5ee-0000-4000-8000-000000000030';
SET LOCAL session_replication_role = origin;

DO $$
BEGIN
  UPDATE public.pagos_factura
     SET notas = 'acuse REP sincronizado'
   WHERE id = 'ee5ee5ee-0000-4000-8000-000000000031';
  RAISE NOTICE 'CASO 5 OK · UPDATE documental (sin dinero ni fecha) sobre factura cancelada sigue pasando.';
END $$;

ROLLBACK;
