-- Ola 3 — Controles del ciclo comercial y fiscal.
-- Casos:
--   1) Cierre de periodo: factura con fecha <= cierre se rechaza; posterior pasa.
--   2) Cierre de periodo: no se puede mover la fecha de un documento ya cerrado.
--   3) Cotización "Aceptada": cambiar subtotal se rechaza (LC_COTIZACION_INMUTABLE).
--   4) Concepto de venta ya proformado: editar precio y borrar se rechazan.
--   5) uuid_fiscal: una vez asignado no puede sobrescribirse.
-- Todo corre como owner (bypass RLS) para probar que los candados son de base
-- de datos y aplican también a procesos internos.
DO $$
DECLARE
  v_org      uuid;
  v_uid      uuid := gen_random_uuid();
  v_cli      uuid;
  v_emb      uuid;
  v_fac      uuid;
  v_cot      uuid;
  v_pf       uuid;
  v_cv       uuid;
  v_err      text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST OLA3 CICLO', 'TO3000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola3-ciclo@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE OLA3', '', 'ola3-ciclo@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELO3X00001', 'Aéreo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  -- ── 1) Cierre de periodo ───────────────────────────────────────────────
  INSERT INTO public.configuracion (organization_id, categoria, clave, valor)
  VALUES (v_org, 'contabilidad', 'cierre_periodo_fecha', to_jsonb('2026-01-31'::text));

  IF public.cierre_periodo_fecha(v_org) <> DATE '2026-01-31' THEN
    RAISE EXCEPTION 'OLA3 FALLA: cierre_periodo_fecha no leyó la configuración';
  END IF;

  BEGIN
    INSERT INTO public.facturas (organization_id, cliente_id, embarque_id, numero,
                                 fecha_emision, moneda, subtotal, total)
    VALUES (v_org, v_cli, v_emb, 'OLA3-CERRADA', DATE '2026-01-15',
            'MXN'::public.moneda, 100, 116);
    RAISE EXCEPTION 'OLA3 FALLA: se permitió facturar dentro del periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_PERIODO_CERRADO%' THEN RAISE; END IF;
  END;

  INSERT INTO public.facturas (organization_id, cliente_id, embarque_id, numero,
                               fecha_emision, moneda, subtotal, total)
  VALUES (v_org, v_cli, v_emb, 'OLA3-ABIERTA', DATE '2026-03-10',
          'MXN'::public.moneda, 100, 116)
  RETURNING id INTO v_fac;

  -- ── 2) Mover la fecha hacia el periodo cerrado ─────────────────────────
  BEGIN
    UPDATE public.facturas SET fecha_emision = DATE '2026-01-10' WHERE id = v_fac;
    RAISE EXCEPTION 'OLA3 FALLA: se permitió mover la fecha al periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_PERIODO_CERRADO%' THEN RAISE; END IF;
  END;

  -- ── 5) uuid_fiscal de una sola escritura ───────────────────────────────
  UPDATE public.facturas
     SET uuid_fiscal = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'
   WHERE id = v_fac;

  BEGIN
    UPDATE public.facturas
       SET uuid_fiscal = '11111111-2222-3333-4444-555555555555'
     WHERE id = v_fac;
    RAISE EXCEPTION 'OLA3 FALLA: se permitió sobrescribir el uuid_fiscal';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_UUID_FISCAL_INMUTABLE%' THEN RAISE; END IF;
  END;

  -- ── 3) Cotización aceptada inmutable ───────────────────────────────────
  INSERT INTO public.cotizaciones (organization_id, cliente_id, folio, estado,
                                   moneda, subtotal, total)
  VALUES (v_org, v_cli, 'COT-OLA3-0001', 'Aceptada'::public.estado_cotizacion,
          'USD'::public.moneda, 1000, 1160)
  RETURNING id INTO v_cot;

  BEGIN
    UPDATE public.cotizaciones SET subtotal = 2000 WHERE id = v_cot;
    RAISE EXCEPTION 'OLA3 FALLA: se permitió cambiar el subtotal de una cotización aceptada';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_COTIZACION_INMUTABLE%' THEN RAISE; END IF;
  END;

  -- ── 4) Concepto de venta ya proformado ─────────────────────────────────
  INSERT INTO public.proformas (organization_id, embarque_id, cliente_id, cliente_nombre, numero)
  VALUES (v_org, v_emb, v_cli, 'CLIENTE OLA3', 'PF-OLA3-0001')
  RETURNING id INTO v_pf;

  INSERT INTO public.conceptos_venta (organization_id, embarque_id, descripcion,
                                      cantidad, precio_unitario, moneda, aplica_iva,
                                      proforma_id)
  VALUES (v_org, v_emb, 'Flete OLA3', 1, 500, 'USD'::public.moneda, true, v_pf)
  RETURNING id INTO v_cv;

  BEGIN
    UPDATE public.conceptos_venta SET precio_unitario = 900 WHERE id = v_cv;
    RAISE EXCEPTION 'OLA3 FALLA: se permitió editar un concepto ya proformado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_CONCEPTO_PROFORMADO%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM public.conceptos_venta WHERE id = v_cv;
    RAISE EXCEPTION 'OLA3 FALLA: se permitió borrar un concepto ya proformado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err NOT LIKE '%LC_CONCEPTO_PROFORMADO%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'OLA3 OK: cierre de periodo, cotización aceptada, concepto proformado y uuid_fiscal blindados';
  RAISE EXCEPTION 'ROLLBACK_OLA3_OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'ROLLBACK_OLA3_OK' THEN
    RAISE NOTICE 'Suite ola3_controles_ciclo: PASÓ (rollback de datos de prueba)';
  ELSE
    RAISE;
  END IF;
END;
$$;
