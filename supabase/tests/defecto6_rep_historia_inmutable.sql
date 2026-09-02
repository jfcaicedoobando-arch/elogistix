-- =============================================================
-- defecto6_rep_historia_inmutable.sql · Auditoría 2026-09-10 (Defecto 6, P1)
--
-- El orden por fecha_pago/created_at de pagos_factura determina la
-- parcialidad y saldos impresos en los REP ya timbrados. Este test valida
-- el guard `assert_pago_no_altera_historia_rep()`:
--   a) INSERT retroactivo (fecha anterior al REP vivo) → falla.
--   b) Soft-delete de un pago anterior al REP vivo → falla.
--   c) Reasignación de ese pago a otra factura → falla.
--   d) INSERT posterior al REP vivo → se permite.
--   e) Con el REP cancelado, la mutación (b) vuelve a permitirse.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/defecto6_rep_historia_inmutable.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111161';
  v_cli uuid := '22222222-2222-2222-2222-222222222261';
  v_fac uuid := '33333333-3333-3333-3333-333333333361';
  v_fac2 uuid := '33333333-3333-3333-3333-333333333362';
  v_pago_anterior uuid := '55555555-5555-5555-5555-555555555561';
  v_pago_rep uuid := '55555555-5555-5555-5555-555555555562';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Defecto6') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Defecto6', 'XAXX010101000', 'd6@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
     subtotal, iva, total, estado, uuid_fiscal)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli Defecto6', 'NC-D6-001',
     CURRENT_DATE - 30, CURRENT_DATE + 25, 'MXN'::public.moneda, 1,
     1000, 0, 1000, 'Emitida'::public.estado_factura, gen_random_uuid()::text),
    (v_fac2, v_org, v_cli, 'Test Cli Defecto6', 'NC-D6-002',
     CURRENT_DATE - 30, CURRENT_DATE + 25, 'MXN'::public.moneda, 1,
     1000, 0, 1000, 'Emitida'::public.estado_factura, gen_random_uuid()::text)
  ON CONFLICT (id) DO NOTHING;

  -- Pago anterior (día -10): no es el REP, pero está antes de él.
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago)
  VALUES
    (v_pago_anterior, v_fac, v_org, CURRENT_DATE - 10, 100, 'MXN'::public.moneda, 1, 100, 'Transferencia');

  -- Pago que se convierte en el REP vivo (día -5).
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago)
  VALUES
    (v_pago_rep, v_fac, v_org, CURRENT_DATE - 5, 100, 'MXN'::public.moneda, 1, 100, 'Transferencia');

  UPDATE public.pagos_factura
     SET uuid_rep = 'REP-D6-TEST', estado_rep = 'Timbrado', folio_rep = 1
   WHERE id = v_pago_rep;
END
$fixture$;

-- a) INSERT retroactivo (día -6, antes del REP de día -5) → falla.
DO $caso_a$
BEGIN
  BEGIN
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago)
    VALUES
      ('55555555-5555-5555-5555-555555555563', '33333333-3333-3333-3333-333333333361',
       '11111111-1111-1111-1111-111111111161', CURRENT_DATE - 6, 50, 'MXN'::public.moneda, 1, 50, 'Transferencia');
    RAISE EXCEPTION 'CASO A FALLÓ: se insertó un pago retroactivo anterior al REP vivo';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%LC_REP_HISTORIA_INMUTABLE%' THEN
        RAISE EXCEPTION 'CASO A FALLÓ: error inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'CASO A OK: LC_REP_HISTORIA_INMUTABLE al insertar pago retroactivo';
  END;
END
$caso_a$;

-- b) Soft-delete del pago anterior (día -10) al REP vivo → falla.
DO $caso_b$
BEGIN
  BEGIN
    UPDATE public.pagos_factura SET deleted_at = now()
     WHERE id = '55555555-5555-5555-5555-555555555561';
    RAISE EXCEPTION 'CASO B FALLÓ: se borró un pago anterior al REP vivo';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%LC_REP_HISTORIA_INMUTABLE%' THEN
        RAISE EXCEPTION 'CASO B FALLÓ: error inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'CASO B OK: LC_REP_HISTORIA_INMUTABLE al borrar pago anterior al REP vivo';
  END;
END
$caso_b$;

-- c) Reasignación del pago anterior a otra factura → falla.
DO $caso_c$
BEGIN
  BEGIN
    UPDATE public.pagos_factura SET factura_id = '33333333-3333-3333-3333-333333333362'
     WHERE id = '55555555-5555-5555-5555-555555555561';
    RAISE EXCEPTION 'CASO C FALLÓ: se reasignó un pago anterior al REP vivo a otra factura';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%LC_REP_HISTORIA_INMUTABLE%' THEN
        RAISE EXCEPTION 'CASO C FALLÓ: error inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'CASO C OK: LC_REP_HISTORIA_INMUTABLE al reasignar pago anterior al REP vivo';
  END;
END
$caso_c$;

-- d) INSERT posterior al REP vivo (día -1) → se permite.
DO $caso_d$
BEGIN
  INSERT INTO public.pagos_factura
    (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
     monto_aplicado_factura, forma_pago)
  VALUES
    ('55555555-5555-5555-5555-555555555564', '33333333-3333-3333-3333-333333333361',
     '11111111-1111-1111-1111-111111111161', CURRENT_DATE - 1, 50, 'MXN'::public.moneda, 1, 50, 'Transferencia');
  RAISE NOTICE 'CASO D OK: pago posterior al REP vivo se registró sin problema';
END
$caso_d$;

-- e) Con el REP cancelado, la mutación (b) vuelve a permitirse.
DO $caso_e$
BEGIN
  UPDATE public.pagos_factura
     SET estado_rep = 'Cancelado', rep_cancelado_en = now()
   WHERE id = '55555555-5555-5555-5555-555555555562';

  UPDATE public.pagos_factura SET deleted_at = now()
   WHERE id = '55555555-5555-5555-5555-555555555561';

  RAISE NOTICE 'CASO E OK: con el REP cancelado, el borrado del pago anterior ya se permite';
END
$caso_e$;

ROLLBACK;
