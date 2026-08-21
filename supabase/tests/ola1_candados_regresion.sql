-- =============================================================
-- ola1_candados_regresion.sql · Ola 1 (candados de horas)
--
-- Red de seguridad conductual para los candados que se agregaron en la
-- Ola 1 y que hasta ahora no tenían prueba propia:
--   · CASO 1 — cobro con fecha futura        → LC_PAGO_FECHA_FUTURA (23514)
--   · CASO 2 — tc_dof_upsert_manual sin rol  → 42501 (EXECUTE revocado o
--               LC_TC_DOF_FORBIDDEN si el rol sí puede invocarla)
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola1_candados_regresion.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '1b1b1b1b-1111-1111-1111-111111111111';
  v_cli uuid := '1b1b1b1b-2222-2222-2222-222222222222';
  v_fac uuid := '1b1b1b1b-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Ola1 Candados')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Ola1', 'XAXX010101000', 'ola1@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli Ola1', 'F-OLA1-CANDADO-01',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 5000, 0, 5000, 'Emitida');
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: cobro fechado mañana → LC_PAGO_FECHA_FUTURA
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_sqlstate text;
  v_msg text;
BEGIN
  BEGIN
    INSERT INTO public.pagos_factura
      (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
    VALUES
      ('1b1b1b1b-4444-4444-4444-444444444401',
       '1b1b1b1b-3333-3333-3333-333333333333',
       '1b1b1b1b-1111-1111-1111-111111111111',
       CURRENT_DATE + 1, 1000, 'MXN', 1, 1000, 'Transferencia', 'OLA1-C1', '', 0);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se aceptó un cobro con fecha futura';
  END IF;
  IF v_msg NOT LIKE '%LC_PAGO_FECHA_FUTURA%' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaba LC_PAGO_FECHA_FUTURA, llegó: % (%)', v_msg, v_sqlstate;
  END IF;
  RAISE NOTICE 'CASO 1 OK · fecha futura bloqueada (%).', v_sqlstate;
END
$caso1$ LANGUAGE plpgsql;

-- -- -------------------------------------------------------------
-- CASO 2: tc_dof_upsert_manual sin sesión super_admin → 42501
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_sqlstate text;
  v_msg text;
BEGIN
  BEGIN
    PERFORM public.tc_dof_upsert_manual(CURRENT_DATE - 1, 18.5, NULL);
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: se permitió capturar T/C DOF sin rol super_admin';
  END IF;
  -- Doble candado válido: EXECUTE revocado (permission denied) o el guard
  -- explícito dentro de la función. Ambos son 42501 (insufficient_privilege).
  IF v_sqlstate <> '42501' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba 42501, llegó: % (%)', v_msg, v_sqlstate;
  END IF;
  RAISE NOTICE 'CASO 2 OK · catálogo global protegido (% / %).', v_sqlstate, v_msg;
END
$caso2$ LANGUAGE plpgsql;

ROLLBACK;
