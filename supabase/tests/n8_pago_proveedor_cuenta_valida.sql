-- =============================================================
-- n8_pago_proveedor_cuenta_valida.sql · v13.823.390
--
-- N8: `registrar_pago_proveedor_atomico` aceptaba cualquier cuenta bancaria
-- existente. La UI filtraba, pero la RPC (SECURITY DEFINER en la práctica para
-- el flujo financiero) debe defender el invariante: la cuenta debe existir,
-- estar ACTIVA y ser de la MISMA organización de la factura.
--
--   · CASO 1 (negativo): cuenta de OTRA organización → LC_PAGO_CUENTA_OTRA_ORG
--     y no queda pago ni movimiento.
--   · CASO 2 (negativo): cuenta inactiva → LC_PAGO_CUENTA_INACTIVA.
--   · CASO 3 (positivo): cuenta propia y activa → el pago se registra.
--   · CASO 4 (contrato): `_asegurar_movimiento_pago_proveedor` conserva la
--     defensa en profundidad (misma org y activa).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/n8_pago_proveedor_cuenta_valida.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_org2 uuid;
  v_prov uuid;
  v_pf uuid;
  v_cta_ok uuid;
  v_cta_off uuid;
  v_cta_otra uuid;
  v_res jsonb;
  v_msg text;
  v_pagos int;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST N8 CUENTA A', 'TN8A00000XX0', 'basico', true) RETURNING id INTO v_org;
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST N8 CUENTA B', 'TN8B00000XX0', 'basico', true) RETURNING id INTO v_org2;

  INSERT INTO public.proveedores (organization_id, nombre, rfc, categoria)
  VALUES (v_org, 'PROVEEDOR N8', 'XAXX010101000', 'Logistico') RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     subtotal, iva, total, moneda, tipo_cambio_usd, fecha_emision,
     estado, estado_aprobacion)
  VALUES
    (v_org, v_prov, 'PROVEEDOR N8', 'F-N8-0001', 1000, 0, 1000,
     'MXN'::public.moneda, 0, CURRENT_DATE,
     'Vigente'::public.estado_proveedor_factura, 'aprobada')
  RETURNING id INTO v_pf;

  INSERT INTO public.cuentas_bancarias (organization_id, alias, moneda, activa)
  VALUES (v_org, 'N8 PROPIA ACTIVA', 'MXN'::public.moneda, true) RETURNING id INTO v_cta_ok;
  INSERT INTO public.cuentas_bancarias (organization_id, alias, moneda, activa)
  VALUES (v_org, 'N8 PROPIA INACTIVA', 'MXN'::public.moneda, false) RETURNING id INTO v_cta_off;
  INSERT INTO public.cuentas_bancarias (organization_id, alias, moneda, activa)
  VALUES (v_org2, 'N8 OTRA ORG', 'MXN'::public.moneda, true) RETURNING id INTO v_cta_otra;

  -- ── CASO 1 · cuenta de otra organización.
  BEGIN
    v_res := public.registrar_pago_proveedor_atomico(
      v_pf, CURRENT_DATE, 100, 'MXN', 'Transferencia', 'N8-C1', v_cta_otra);
    RAISE EXCEPTION 'REGRESION P0: se aceptó una cuenta de otra organización';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ 'LC_PAGO_CUENTA_OTRA_ORG' THEN
      RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaba LC_PAGO_CUENTA_OTRA_ORG, se obtuvo: %', v_msg;
    END IF;
  END;

  SELECT count(*) INTO v_pagos FROM public.pagos_proveedor WHERE proveedor_factura_id = v_pf;
  IF v_pagos <> 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: quedaron % pagos tras el rechazo', v_pagos;
  END IF;
  RAISE NOTICE 'CASO 1 OK: cuenta de otra organización rechazada sin dejar pago';

  -- ── CASO 2 · cuenta inactiva.
  BEGIN
    v_res := public.registrar_pago_proveedor_atomico(
      v_pf, CURRENT_DATE, 100, 'MXN', 'Transferencia', 'N8-C2', v_cta_off);
    RAISE EXCEPTION 'REGRESION P0: se aceptó una cuenta inactiva';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ 'LC_PAGO_CUENTA_INACTIVA' THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba LC_PAGO_CUENTA_INACTIVA, se obtuvo: %', v_msg;
    END IF;
  END;
  RAISE NOTICE 'CASO 2 OK: cuenta inactiva rechazada';

  -- ── CASO 3 · cuenta propia y activa: el flujo válido no cambia.
  v_res := public.registrar_pago_proveedor_atomico(
    v_pf, CURRENT_DATE, 100, 'MXN', 'Transferencia', 'N8-C3', v_cta_ok);
  IF (v_res->>'pago_id') IS NULL THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el pago con cuenta válida no se registró';
  END IF;
  RAISE NOTICE 'CASO 3 OK: el pago con cuenta propia y activa se registró';

  -- ── CASO 4 · contrato de defensa en profundidad.
  IF pg_get_functiondef('public._asegurar_movimiento_pago_proveedor(uuid)'::regprocedure)
       !~ 'LC_MOVIMIENTO_CUENTA_OTRA_ORG'
     OR pg_get_functiondef('public._asegurar_movimiento_pago_proveedor(uuid)'::regprocedure)
       !~ 'LC_MOVIMIENTO_CUENTA_INACTIVA' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: el movimiento bancario dejó de validar la cuenta';
  END IF;
  RAISE NOTICE 'CASO 4 OK: el movimiento conserva la validación de cuenta';
END;
$$;

ROLLBACK;
