-- =============================================================
-- cxp_sobrecosto_misma_moneda.sql · FP-000256
--
-- `_cxp_validar_aprobacion` no debe inventar sobrecosto por efecto
-- cambiario: cuando el costo comprometido y TODAS las facturas ligadas
-- están en la misma moneda, la comparación se hace en esa moneda.
--
-- Casos:
--   1) Costo 60 USD (T/C embarque 17.3317) vs factura 60 USD
--      (T/C factura 19.4715) -> NO bloquea (antes: 1,039.90 vs 1,168.29 MXN).
--   2) Misma moneda con exceso real >5% (70 USD vs 60 USD) -> LC_CXP_SOBRECOSTO.
--   3) Monedas distintas (costo USD, factura MXN) -> se conserva la ruta MXN.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxp_sobrecosto_misma_moneda.sql
-- =============================================================

BEGIN;

DO $t$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_cat uuid;
  v_prov uuid;
  v_cc uuid;
  v_pf uuid;
  v_state text;
  v_msg text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CXP SOBRECOSTO MONEDA', 'TCS000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'cxp-sobrecosto@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CXP SOBRECOSTO', '', 'cxp.sobrecosto@test.local')
  RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, tipo_cambio_usd)
  VALUES (v_org, v_cli, 'ELCSM00001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 17.3317)
  RETURNING id INTO v_emb;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_org, 'Costo directo TEST CXP SOBRECOSTO', 1, true, 'CostoDirectoEmbarque')
  RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR CXP SOBRECOSTO', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.conceptos_costo
    (organization_id, embarque_id, proveedor_id, proveedor_nombre, concepto, monto, moneda)
  VALUES (v_org, v_emb, v_prov, 'PROVEEDOR CXP SOBRECOSTO', 'Cargos Destino', 60,
          'USD'::public.moneda)
  RETURNING id INTO v_cc;

  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, embarque_id, folio_proveedor, categoria_presupuesto_id,
     subtotal, iva, total, moneda, tipo_cambio_usd, fecha_emision, estado, estado_aprobacion)
  VALUES (v_org, v_prov, v_emb, 'SOBRECOSTO-USD-01', v_cat,
          60, 0, 60, 'USD'::public.moneda, 19.4715, CURRENT_DATE,
          'Vigente'::public.estado_proveedor_factura, 'pendiente')
  RETURNING id INTO v_pf;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Cargos Destino', 1, 60);

  -- CASO 1: misma moneda, mismo importe -> no debe bloquear.
  BEGIN
    PERFORM public._cxp_validar_aprobacion(v_pf, NULL);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> '00000' THEN
    RAISE EXCEPTION 'FAIL caso 1: 60 USD vs 60 USD no debía bloquear, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE '✓ caso 1: sin sobrecosto fantasma por tipo de cambio';

  -- CASO 2: misma moneda con exceso real de 10 USD (16.7% > 5%).
  UPDATE public.proveedor_facturas SET subtotal = 70, total = 70 WHERE id = v_pf;
  UPDATE public.proveedor_facturas_conceptos SET monto = 70
   WHERE proveedor_factura_id = v_pf;

  v_msg := NULL;
  BEGIN
    PERFORM public._cxp_validar_aprobacion(v_pf, NULL);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state = '00000' OR COALESCE(v_msg, '') NOT LIKE 'LC_CXP_SOBRECOSTO%' THEN
    RAISE EXCEPTION 'FAIL caso 2: se esperaba LC_CXP_SOBRECOSTO, vino % / %', v_state, v_msg;
  END IF;
  IF v_msg NOT LIKE '%USD%' THEN
    RAISE EXCEPTION 'FAIL caso 2: el mensaje debía expresarse en USD: %', v_msg;
  END IF;
  RAISE NOTICE '✓ caso 2: exceso real >5%% en la misma moneda sigue bloqueado (%)', v_msg;

  -- CASO 3: monedas distintas (costo USD, factura MXN) -> ruta MXN.
  -- 60 USD @17.3317 = 1,039.90 MXN comprometidos; factura por 1,500 MXN.
  UPDATE public.proveedor_facturas
     SET moneda = 'MXN'::public.moneda, tipo_cambio_usd = NULL, subtotal = 1500, total = 1500
   WHERE id = v_pf;
  UPDATE public.proveedor_facturas_conceptos SET monto = 1500
   WHERE proveedor_factura_id = v_pf;

  v_msg := NULL;
  BEGIN
    PERFORM public._cxp_validar_aprobacion(v_pf, NULL);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state = '00000' OR COALESCE(v_msg, '') NOT LIKE 'LC_CXP_SOBRECOSTO%' THEN
    RAISE EXCEPTION 'FAIL caso 3: monedas distintas debían comparar en MXN y bloquear, vino % / %',
      v_state, v_msg;
  END IF;
  IF v_msg NOT LIKE '%MXN%' THEN
    RAISE EXCEPTION 'FAIL caso 3: el mensaje debía expresarse en MXN: %', v_msg;
  END IF;
  RAISE NOTICE '✓ caso 3: cruce de monedas conserva la comparación en MXN (%)', v_msg;
END
$t$ LANGUAGE plpgsql;

ROLLBACK;
