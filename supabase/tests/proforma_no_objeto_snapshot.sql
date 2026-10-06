-- Local disposable full-schema regression; no network, PAC or live fiscal action.
-- Exercises the real consolidation and invoice-line conversion functions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION pg_temp.assert_no_objeto(p_ok boolean, p_message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PROFORMA_NO_OBJETO: %', p_message;
  END IF;
END;
$$;
DO $test$
DECLARE
  v_org uuid := gen_random_uuid(); v_cli uuid := gen_random_uuid(); v_uid uuid := gen_random_uuid();
  v_e uuid; v_p1 uuid; v_p2 uuid; v_f uuid; v_result public.proformas;
  v_mon public.moneda; v_tipo text; v_constraint text; v_case integer := 0;
  v_snapshot uuid; v_before jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
  VALUES (CURRENT_DATE, 18, 20, 'manual') ON CONFLICT (fecha) DO NOTHING;
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'TEST no objeto consolidation');
  INSERT INTO auth.users(id, email) VALUES (v_uid, 'no-objeto-consolidation@example.invalid');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (v_org, v_uid, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Synthetic fiscal client', 'no-objeto-client@example.invalid');

  FOREACH v_mon IN ARRAY ARRAY['MXN'::public.moneda, 'USD'::public.moneda] LOOP
    v_case := v_case + 1;
    v_e := gen_random_uuid(); v_p1 := gen_random_uuid(); v_p2 := gen_random_uuid(); v_f := gen_random_uuid();
    INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo)
    VALUES (v_e, v_org, v_cli, 'ELPNO' || (92000 + v_case), 'Marítimo', 'Importación');
    INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id, cliente_nombre,
      expediente, numero, estado_aprobacion)
    VALUES (v_p1, v_org, v_e, v_cli, 'Synthetic fiscal client', 'ELPNO' || (92000 + v_case),
      'TEST-NO-OBJETO-A-' || v_case, 'aprobada'),
      (v_p2, v_org, v_e, v_cli, 'Synthetic fiscal client', 'ELPNO' || (92000 + v_case),
      'TEST-NO-OBJETO-B-' || v_case, 'aprobada');
    -- The source uses its existing numeric zero representation. Consolidation
    -- deliberately emits NULL for no_objeto, distinct from exento and tasa_0.
    INSERT INTO public.conceptos_venta(organization_id, embarque_id, proforma_id, descripcion,
      cantidad, precio_unitario, total, moneda, aplica_iva, tipo_iva, tasa_iva_aplicada, estado_facturacion)
    SELECT v_org, v_e, p.id, 'Same service', p.cantidad, 100, p.cantidad * 100, v_mon,
      t.tipo IN ('gravado_16', 'gravado_8', 'tasa_0'), t.tipo, t.tasa, 'en_proforma'
    FROM (VALUES (v_p1, 1), (v_p2, 2)) AS p(id, cantidad)
    CROSS JOIN (VALUES ('no_objeto', 0), ('exento', 0), ('tasa_0', 0),
      ('gravado_16', 0.16), ('gravado_8', 0.08)) AS t(tipo, tasa);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
    v_result := public.consolidar_proformas(v_e, v_cli, 'Synthetic fiscal client',
      'ELPNO' || (92000 + v_case), NULL, 'TEST', 30, v_org, ARRAY[v_p1, v_p2]);
    PERFORM pg_temp.assert_no_objeto(v_result.es_consolidada AND
      CASE v_mon WHEN 'MXN' THEN v_result.subtotal_mxn = 1500 AND v_result.iva_mxn = 72
        AND v_result.total_mxn = 1572 AND v_result.total_usd = 0
      ELSE v_result.subtotal_usd = 1500 AND v_result.iva_usd = 72
        AND v_result.total_usd = 1572 AND v_result.total_mxn = 0 END,
      'consolidated amounts remain correct in ' || v_mon);
    PERFORM pg_temp.assert_no_objeto((SELECT count(*) = 5 AND count(DISTINCT tipo_iva) = 5
      AND bool_and(cantidad = 3 AND precio_unitario = 100 AND total = 300 AND moneda = v_mon)
      FROM public.proforma_conceptos_consolidados WHERE proforma_id = v_result.id),
      'five fiscal treatments remain separate despite identical service/price/currency');
    PERFORM pg_temp.assert_no_objeto((SELECT tipo_iva = 'no_objeto' AND tasa_iva_aplicada IS NULL
      AND aplica_iva IS FALSE AND iva = 0 FROM public.proforma_conceptos_consolidados
      WHERE proforma_id = v_result.id AND tipo_iva = 'no_objeto'), 'no_objeto snapshot preserves absence of rate');
    PERFORM pg_temp.assert_no_objeto((SELECT bool_and(tasa_iva_aplicada IS NOT DISTINCT FROM CASE tipo_iva
      WHEN 'gravado_16' THEN 0.16 WHEN 'gravado_8' THEN 0.08 ELSE 0 END
      AND iva = CASE tipo_iva WHEN 'gravado_16' THEN 48 WHEN 'gravado_8' THEN 24 ELSE 0 END)
      FROM public.proforma_conceptos_consolidados WHERE proforma_id = v_result.id AND tipo_iva <> 'no_objeto'),
      'taxable, zero-rated and exempt snapshots retain their existing rates and amounts');

    INSERT INTO public.facturas(id, organization_id, numero, cliente_id, cliente_nombre,
      embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
    VALUES (v_f, v_org, 'TEST-NO-OBJETO-F-' || v_case, v_cli, 'Synthetic fiscal client',
      v_e, 1500, 72, 1572, v_mon, 1, 'Borrador', CURRENT_DATE);
    PERFORM public._convertir_proformas_insertar_conceptos(v_f, ARRAY[v_result.id], v_org, true, v_mon);
    PERFORM pg_temp.assert_no_objeto((SELECT count(*) = 5 AND count(DISTINCT tipo_iva) = 5
      AND bool_and(cantidad = 3 AND precio_unitario = 100 AND total = 300 AND moneda = v_mon
        AND proforma_id_origen = v_result.id AND embarque_id = v_e)
      FROM public.conceptos_factura WHERE factura_id = v_f), 'conversion preserves source, amounts and all five treatments');
    PERFORM pg_temp.assert_no_objeto((SELECT tasa_iva_aplicada IS NULL FROM public.conceptos_factura
      WHERE factura_id = v_f AND tipo_iva = 'no_objeto'), 'no_objeto reaches invoice with NULL rate');
    PERFORM pg_temp.assert_no_objeto((SELECT bool_and(CASE tipo_iva
      WHEN 'exento' THEN tasa_iva_aplicada IS NULL WHEN 'tasa_0' THEN tasa_iva_aplicada IS NOT DISTINCT FROM 0
      WHEN 'gravado_16' THEN tasa_iva_aplicada IS NOT DISTINCT FROM 0.16 WHEN 'gravado_8' THEN tasa_iva_aplicada IS NOT DISTINCT FROM 0.08 END)
      FROM public.conceptos_factura WHERE factura_id = v_f AND tipo_iva <> 'no_objeto'),
      'invoice conversion preserves canonical rates of other treatments');

    -- Missing rate never becomes valid merely because tipo_iva is unknown/NULL.
    FOREACH v_tipo IN ARRAY ARRAY[NULL, 'unknown', 'exento', 'tasa_0', 'gravado_16', 'gravado_8'] LOOP
      BEGIN
        INSERT INTO public.proforma_conceptos_consolidados(proforma_id, organization_id,
          descripcion, cantidad, precio_unitario, total, tipo_iva, tasa_iva_aplicada)
        VALUES (v_result.id, v_org, 'Invalid missing rate', 1, 100, 100, v_tipo, NULL);
        RAISE EXCEPTION 'PROFORMA_NO_OBJETO_EXPECTED_REJECTION: %', v_tipo;
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        PERFORM pg_temp.assert_no_objeto(v_constraint = 'pcc_tasa_iva_presente_chk',
          'strict conditional rate constraint rejects ' || COALESCE(v_tipo, 'NULL'));
      END;
    END LOOP;
    SELECT id, to_jsonb(pcc) INTO v_snapshot, v_before FROM public.proforma_conceptos_consolidados pcc
      WHERE proforma_id = v_result.id AND tipo_iva = 'no_objeto';
    BEGIN
      UPDATE public.proforma_conceptos_consolidados SET tipo_iva = NULL WHERE id = v_snapshot;
      RAISE EXCEPTION 'PROFORMA_NO_OBJETO_EXPECTED_UPDATE_REJECTION';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      PERFORM pg_temp.assert_no_objeto(v_constraint = 'pcc_tasa_iva_presente_chk', 'cannot erase type on NULL-rate row');
    END;
    PERFORM pg_temp.assert_no_objeto((SELECT to_jsonb(pcc) = v_before
      FROM public.proforma_conceptos_consolidados pcc WHERE id = v_snapshot), 'failed update preserves complete snapshot');
    -- Existing numeric no_objeto snapshots stay acceptable; no historical coercion.
    UPDATE public.proforma_conceptos_consolidados SET tasa_iva_aplicada = 0 WHERE id = v_snapshot;
    -- The nullable storage fix must not hide incoherent no_objeto fiscal data.
    UPDATE public.proforma_conceptos_consolidados SET tasa_iva_aplicada = 0.16 WHERE id = v_snapshot;
    BEGIN
      PERFORM public._convertir_proformas_insertar_conceptos(v_f, ARRAY[v_result.id], v_org, true, v_mon);
      RAISE EXCEPTION 'PROFORMA_NO_OBJETO_EXPECTED_FISCAL_REJECTION';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_PROFORMA_IVA_INCOHERENTE:%' THEN RAISE; END IF;
    END;
    PERFORM pg_temp.assert_no_objeto((SELECT count(*) = 5 FROM public.conceptos_factura WHERE factura_id = v_f),
      'incoherent no_objeto conversion fails without inserting invoice lines');
    UPDATE public.proforma_conceptos_consolidados SET tasa_iva_aplicada = NULL WHERE id = v_snapshot;
    INSERT INTO public.proforma_conceptos_consolidados(proforma_id, organization_id,
      descripcion, cantidad, precio_unitario, total, tipo_iva, tasa_iva_aplicada)
    VALUES (v_result.id, v_org, 'Legacy numeric rate remains valid', 1, 100, 100, NULL, 0.16);
    PERFORM pg_temp.assert_no_objeto((SELECT tasa_iva_aplicada = 0.16 AND total = 100
      FROM public.proforma_conceptos_consolidados WHERE proforma_id = v_result.id AND tipo_iva IS NULL),
      'legacy numeric snapshots remain unchanged');
    PERFORM set_config('request.jwt.claims', '', true);
    RAISE NOTICE 'PASS consolidation, conversion and NULL-rate positive/negative cases in %', v_mon;
  END LOOP;
END;
$test$;
ROLLBACK;
