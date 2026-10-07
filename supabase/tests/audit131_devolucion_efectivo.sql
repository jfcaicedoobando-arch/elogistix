-- Audit131: ordinary cash/bank refund fixtures in disposable PostgreSQL.
-- Existing guards stay active; every synthetic mutation rolls back.
BEGIN;

DO $catalog$
DECLARE
  v_rpc regprocedure := 'public.devolver_anticipo_proveedor(uuid,numeric,date,uuid,text,text,text)'::regprocedure;
BEGIN
  IF to_regprocedure('public.devolver_anticipo_proveedor(uuid,numeric,date,uuid,text,text)') IS NOT NULL
     OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='devolver_anticipo_proveedor') <> 1 THEN
    RAISE EXCEPTION 'TEST FAIL: competing refund overload remains';
  END IF;
  IF (SELECT pronargdefaults FROM pg_proc WHERE oid=v_rpc) <> 3
     OR (SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE oid=v_rpc) NOT LIKE '%p_medio text DEFAULT ''Bancario''::text' THEN
    RAISE EXCEPTION 'TEST FAIL: legacy argument defaults changed';
  END IF;
  IF has_function_privilege('anon',v_rpc,'EXECUTE')
     OR NOT has_function_privilege('authenticated',v_rpc,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_rpc,'EXECUTE') THEN
    RAISE EXCEPTION 'TEST FAIL: refund execution audience changed';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='anticipos_proveedor'
        AND column_name IN ('fecha_devolucion','medio_devolucion','referencia_devolucion')
        AND is_nullable='YES' AND column_default IS NULL) <> 3 THEN
    RAISE EXCEPTION 'TEST FAIL: historical refund facts must remain nullable without a fabricated default';
  END IF;
END $catalog$;

DO $fixture$
DECLARE
  v_org  uuid := 'e1111111-1111-1111-1111-111111111111';
  v_uid  uuid := 'e5555555-5555-5555-5555-555555555555';
  v_prov uuid := 'e3333333-3333-3333-3333-333333333333';
  v_cat  uuid := 'e6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org E Anticipos')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'anticipos-e@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov E', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat E', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- fecha_saldo_inicial explícita: el DEFAULT usa la fecha UTC, que puede ser
  -- posterior a public.fecha_negocio_mx() (CDMX) y bloquearía el guard de movimientos.
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda, fecha_saldo_inicial)
  VALUES ('e7777777-7777-7777-7777-777777777777', v_org, 'MXN E', 'MXN'::public.moneda, public.fecha_negocio_mx())
  ON CONFLICT (id) DO NOTHING;

  -- Devolución histórica: sin los tres nuevos datos, conserva el fallback previo.
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible, monto_devuelto, devuelto_at, referencia
  ) VALUES (
    'e9999999-9999-9999-9999-999999999999', v_org, v_prov,
    public.fecha_negocio_mx() - 10, 400, 'MXN'::public.moneda, 'devuelto', 0, 400, now(), 'LEGACY-ORIGINAL'
  ) ON CONFLICT (id) DO NOTHING;

  -- Facturas MXN abiertas para el pago en lote (mínimo 2 renglones).
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, subtotal, iva, total,
    estado, estado_aprobacion, fecha_emision
  ) VALUES (
    'eb000000-0000-0000-0000-00000000000b', v_org, v_prov, 'Test Prov E', 'MNY-P12-01',
    v_cat, 'MXN'::public.moneda, 300, 0, 300, 'Vigente', 'aprobada',
    public.fecha_negocio_mx() - 5
  ), (
    'eb000000-0000-0000-0000-00000000000c', v_org, v_prov, 'Test Prov E', 'MNY-P12-02',
    v_cat, 'MXN'::public.moneda, 200, 0, 200, 'Vigente', 'aprobada',
    public.fecha_negocio_mx() - 5
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END
$fixture$ LANGUAGE plpgsql;

DO $test$
DECLARE
 v_id uuid; v_bank uuid; v_original jsonb; v_after jsonb; v_row public.anticipos_proveedor; v_json jsonb; v_detail jsonb;
 v_prov uuid := 'e3333333-3333-3333-3333-333333333333';
 v_cta uuid := 'e7777777-7777-7777-7777-777777777777';
BEGIN
 IF EXISTS(SELECT 1 FROM public.anticipos_proveedor WHERE id='e9999999-9999-9999-9999-999999999999'
           AND (medio_devolucion IS NOT NULL OR fecha_devolucion IS NOT NULL OR referencia_devolucion IS NOT NULL)) THEN
  RAISE EXCEPTION 'TEST FAIL: historical refund facts were fabricated';
 END IF;
 v_json := public.pago_detalle('devolucion_anticipo','e9999999-9999-9999-9999-999999999999');
 IF v_json->'pago'->>'referencia' IS DISTINCT FROM 'LEGACY-ORIGINAL'
    OR v_json->'pago'->>'metodo_pago' IS NOT NULL THEN
  RAISE EXCEPTION 'TEST FAIL: historical reference fallback or unknown medium was changed';
 END IF;
 v_id := (public.registrar_anticipo_proveedor(p_proveedor_id=>v_prov,p_monto=>1,p_moneda=>'MXN',p_fecha_anticipo=>public.fecha_negocio_mx()-2,p_metodo_pago=>'Efectivo')).id;
 BEGIN
  PERFORM public.devolver_anticipo_proveedor(v_id,1,public.fecha_negocio_mx()-1,v_cta,NULL,'Reembolso','Efectivo');
  RAISE EXCEPTION 'TEST FAIL: cash with bank accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN
  IF SQLERRM NOT LIKE 'LC_ANTICIPO_EFECTIVO_CON_CUENTA:%' THEN RAISE; END IF;
 END;
 v_row := public.devolver_anticipo_proveedor(v_id,1,public.fecha_negocio_mx()-1,NULL,'REC-1','Reembolso efectivo','Efectivo');
 IF v_row.estado<>'devuelto' OR v_row.saldo_disponible<>0 OR v_row.monto<>1
    OR v_row.fecha_devolucion<>public.fecha_negocio_mx()-1 OR v_row.medio_devolucion<>'Efectivo' THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund lost economic facts';
 END IF;
 IF EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE anticipo_proveedor_id=v_id) THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund fabricated bank movement';
 END IF;
 v_json := public.libro_pagos(public.fecha_negocio_mx()-1,public.fecha_negocio_mx()-1,'e1111111-1111-1111-1111-111111111111');
 SELECT x INTO v_detail FROM jsonb_array_elements(v_json->'pagos') x WHERE x->>'id'=v_id::text AND x->>'tipo'='devolucion_anticipo';
 IF v_detail IS NULL OR v_detail->>'metodo_pago'<>'Efectivo' OR v_detail->>'referencia'<>'REC-1' THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund absent or misdated in ledger: %',v_detail;
 END IF;
 v_json := public.pago_detalle('devolucion_anticipo',v_id);
 v_detail := v_json->'pago';
 IF v_detail->>'metodo_pago' IS DISTINCT FROM 'Efectivo'
    OR v_detail->>'referencia' IS DISTINCT FROM 'REC-1'
    OR (v_detail->>'fecha')::date IS DISTINCT FROM public.fecha_negocio_mx()-1
    OR v_detail->>'cuenta_bancaria_id' IS NOT NULL
    OR v_json->'movimiento' IS DISTINCT FROM 'null'::jsonb THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund detail lost medium/date/reference or fabricated bank: %',v_json;
 END IF;
 v_json := public.proveedor_estado_cuenta_movimientos(v_prov);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_json->'movimientos') m WHERE m->>'ref_id'=v_id::text AND m->>'tipo'='Devolución de anticipo' AND (m->>'fecha')::date=public.fecha_negocio_mx()-1 AND (m->>'cargo')::numeric=1) THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund absent or misdated in statement';
 END IF;
 -- An originally cash advance may legitimately be returned by bank.
 -- A legacy six-argument call retains the Bancario default without an overload.
 v_bank := (public.registrar_anticipo_proveedor(p_proveedor_id=>v_prov,p_monto=>1,p_moneda=>'MXN',p_fecha_anticipo=>public.fecha_negocio_mx(),p_metodo_pago=>'Efectivo')).id;
 v_row := public.devolver_anticipo_proveedor(v_bank,1,public.fecha_negocio_mx(),v_cta,'BANK-1','Depósito recibido');
 IF (SELECT count(*) FROM public.bbva_movimientos WHERE anticipo_proveedor_id=v_bank AND abono=1)<>1 THEN
  RAISE EXCEPTION 'TEST FAIL: bank refund not exactly one deposit: id %, rows %', v_bank, (SELECT jsonb_agg(to_jsonb(b)) FROM public.bbva_movimientos b WHERE anticipo_proveedor_id=v_bank);
 END IF;
 IF v_row.metodo_pago<>'Efectivo' OR v_row.medio_devolucion<>'Bancario' THEN
  RAISE EXCEPTION 'TEST FAIL: original payment method was rewritten';
 END IF;
 -- A bank-funded advance returned as cash keeps the exact original charge.
 v_bank := (public.registrar_anticipo_proveedor(p_proveedor_id=>v_prov,p_monto=>1,p_moneda=>'MXN',p_fecha_anticipo=>public.fecha_negocio_mx(),p_metodo_pago=>'Transferencia',p_cuenta_bancaria_id=>v_cta,p_referencia=>'ORIGINAL-BANK-REF')).id;
 SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) INTO v_original FROM public.bbva_movimientos b WHERE anticipo_proveedor_id=v_bank;
 v_row := public.devolver_anticipo_proveedor(v_bank,1,public.fecha_negocio_mx(),NULL,NULL,'Efectivo recibido','Efectivo');
 SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) INTO v_after FROM public.bbva_movimientos b WHERE anticipo_proveedor_id=v_bank;
 IF v_original IS NULL OR v_after IS DISTINCT FROM v_original
    OR v_row.metodo_pago IS DISTINCT FROM 'Transferencia'
    OR v_row.medio_devolucion IS DISTINCT FROM 'Efectivo' THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund changed the original bank charge or payment facts';
 END IF;
 v_json := public.pago_detalle('devolucion_anticipo',v_bank);
 IF v_json->'pago'->>'referencia' IS NOT NULL THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund without reference inherited original payment reference: %',v_json->'pago'->>'referencia';
 END IF;
 v_json := public.libro_pagos(public.fecha_negocio_mx(),public.fecha_negocio_mx(),'e1111111-1111-1111-1111-111111111111');
 SELECT x INTO v_detail FROM jsonb_array_elements(v_json->'pagos') x WHERE x->>'id'=v_bank::text AND x->>'tipo'='devolucion_anticipo';
 IF v_detail IS NULL OR v_detail->>'referencia' IS NOT NULL THEN
  RAISE EXCEPTION 'TEST FAIL: cash refund ledger inherited original payment reference: %',v_detail;
 END IF;
 RAISE NOTICE 'audit131: cash refund, civil date, ledger, statement and legitimate bank refund passed';
END $test$;
ROLLBACK;
