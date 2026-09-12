-- =============================================================
-- cxp_conceptos_cabecera_sin_duplicar_vinculo.sql · FP-000253
--
-- `reemplazar_conceptos_factura_proveedor` recalcula la cabecera SÓLO con
-- el desglose fiscal del proveedor (concepto_costo_id IS NULL). Los
-- renglones de vínculo con `conceptos_costo` no son cargos: sumarlos
-- duplicaba el total (332 USD -> 664 USD en FP-000253).
--
-- Casos:
--   1) Desglose fiscal (150+120+12+50 = 332) + 1 renglón de vínculo por 332
--      -> subtotal 332, total 332; el renglón de vínculo se conserva.
--   2) Sin desglose fiscal (sólo vínculo) -> se conserva el comportamiento
--      anterior: la cabecera no queda en cero.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxp_conceptos_cabecera_sin_duplicar_vinculo.sql
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
  v_sub numeric;
  v_tot numeric;
  v_vinc int;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CXP CABECERA VINCULO', 'TCV000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'cxp-cabecera@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CXP CABECERA', '', 'cxp.cabecera@test.local')
  RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, tipo_cambio_usd)
  VALUES (v_org, v_cli, 'ELCCV00001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 16.9237)
  RETURNING id INTO v_emb;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_org, 'Costo directo TEST CXP CABECERA', 1, true, 'CostoDirectoEmbarque')
  RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR CXP CABECERA', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.conceptos_costo
    (organization_id, embarque_id, proveedor_id, proveedor_nombre, concepto, monto, moneda)
  VALUES (v_org, v_emb, v_prov, 'PROVEEDOR CXP CABECERA', 'Flete Maritimo', 332,
          'USD'::public.moneda)
  RETURNING id INTO v_cc;

  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, embarque_id, folio_proveedor, categoria_presupuesto_id,
     subtotal, iva, total, moneda, tipo_cambio_usd, fecha_emision, estado, estado_aprobacion)
  VALUES (v_org, v_prov, v_emb, 'CABECERA-USD-01', v_cat,
          332, 0, 332, 'USD'::public.moneda, 16.9237, CURRENT_DATE,
          'Vigente'::public.estado_proveedor_factura, 'pendiente')
  RETURNING id INTO v_pf;

  -- Renglón de vínculo con el costo del expediente (no es un cargo fiscal).
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Flete Maritimo', 1, 332);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- CASO 1: el desglose fiscal manda; no se suma el renglón de vínculo.
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf, jsonb_build_array(
    jsonb_build_object('descripcion', 'OCEAN FREIGHT 1/40HQ', 'cantidad', 1, 'monto', 150),
    jsonb_build_object('descripcion', 'EBS EMERGENCY BAF 1/40HQ', 'cantidad', 1, 'monto', 120),
    jsonb_build_object('descripcion', 'HSS HI SEC SEAL CH 1/40HQ', 'cantidad', 1, 'monto', 12),
    jsonb_build_object('descripcion', 'DOC O/B DOC FEE', 'cantidad', 1, 'monto', 50)
  ));

  SELECT subtotal, total INTO v_sub, v_tot
    FROM public.proveedor_facturas WHERE id = v_pf;
  IF ROUND(v_sub, 2) <> 332.00 OR ROUND(v_tot, 2) <> 332.00 THEN
    RAISE EXCEPTION 'FAIL caso 1: se esperaba 332/332, vino %/%', v_sub, v_tot;
  END IF;

  SELECT COUNT(*) INTO v_vinc FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = v_pf AND concepto_costo_id IS NOT NULL;
  IF v_vinc <> 1 THEN
    RAISE EXCEPTION 'FAIL caso 1: el renglón de vínculo debía conservarse, hay %', v_vinc;
  END IF;
  RAISE NOTICE '✓ caso 1: cabecera 332 USD sin duplicar el renglón de vínculo';

  -- CASO 2: sin desglose fiscal, la cabecera cae al renglón de vínculo (no cero).
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf, '[]'::jsonb);

  SELECT subtotal, total INTO v_sub, v_tot
    FROM public.proveedor_facturas WHERE id = v_pf;
  IF ROUND(v_sub, 2) <> 332.00 OR ROUND(v_tot, 2) <> 332.00 THEN
    RAISE EXCEPTION 'FAIL caso 2: sin desglose fiscal se esperaba 332/332, vino %/%', v_sub, v_tot;
  END IF;
  RAISE NOTICE '✓ caso 2: sin desglose fiscal la cabecera no queda en cero';

  PERFORM set_config('request.jwt.claims', NULL, true);
END
$t$ LANGUAGE plpgsql;

ROLLBACK;
