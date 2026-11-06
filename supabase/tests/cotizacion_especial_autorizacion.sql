-- End-to-end SQL regression using real auth/org_scope, RLS and handover functions.
-- All actors and rows are synthetic; no trigger disable or authorization bypass.
BEGIN;
DO $test$
DECLARE
  v_org uuid; v_actor uuid := gen_random_uuid(); v_coord uuid := gen_random_uuid();
  v_cliente uuid; v_cot uuid; v_emb uuid; v_handover uuid; v_count int;
BEGIN
  INSERT INTO public.organizations(nombre) VALUES ('QA0037 especial permisos') RETURNING id INTO v_org;
  INSERT INTO auth.users(id,email) VALUES (v_actor,v_actor::text||'@test.invalid'),(v_coord,v_coord::text||'@test.invalid');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
    (v_org,v_actor,'admin_org'),(v_org,v_coord,'coordinador_logistico');
  INSERT INTO public.user_roles(user_id,role) VALUES (v_actor,'admin_org'),(v_coord,'coordinador_logistico') ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  INSERT INTO public.clientes(organization_id,nombre,email,tipo_cliente)
    VALUES(v_org,'QA0037 especial',gen_random_uuid()::text||'@test.invalid','especial') RETURNING id INTO v_cliente;
  INSERT INTO public.cotizaciones(organization_id,cliente_id,cliente_nombre,estado,folio,modo,tipo,moneda,tipo_cambio_usd,conceptos_venta,peso_kg)
    VALUES(v_org,v_cliente,'QA0037 especial','Borrador','QA0037-'||gen_random_uuid(),'Terrestre','Nacional','MXN',20,
      '[{"descripcion":"Transporte prueba","cantidad":1,"precio_unitario":1000,"moneda":"MXN","total":1000}]',100) RETURNING id INTO v_cot;
  INSERT INTO public.cotizacion_costos(organization_id,cotizacion_id,concepto,moneda,cantidad,costo_unitario,precio_venta)
    VALUES(v_org,v_cot,'Transporte prueba','MXN',1,700,0);
  PERFORM set_config('role','authenticated',true);
  IF public.org_scope() IS DISTINCT FROM v_org OR auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'QA0037: real tenant/actor not established';
  END IF;
  UPDATE public.cotizaciones SET estado='Enviada' WHERE id=v_cot;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 OR NOT EXISTS(SELECT 1 FROM public.cotizaciones WHERE id=v_cot
     AND autorizada_at IS NOT NULL AND autorizada_por=v_actor AND margen_autorizado_pct=30
     AND autorizacion_motivo='Cliente especial: no requiere autorización') THEN
    RAISE EXCEPTION 'QA0037: authenticated automatic authorization/margin failed';
  END IF;
  -- Main0038 assigns special clients to the quote creator, not the round-robin coordinator.
  SELECT id INTO STRICT v_handover FROM public.cotizacion_handovers WHERE cotizacion_id=v_cot AND coordinador_id=v_actor;
  BEGIN
    PERFORM public._cotizacion_margen_pct(v_cot);
    RAISE EXCEPTION 'QA0037: private helper exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.cotizaciones SET estado='Aceptada' WHERE id=v_cot;
  SELECT embarque_id INTO v_emb FROM public.cotizaciones WHERE id=v_cot AND estado='Aceptada';
  IF v_emb IS NULL THEN RAISE EXCEPTION 'QA0037: acceptance did not create real draft shipment'; END IF;
  IF auth.uid() IS DISTINCT FROM v_actor OR public.org_scope() IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'QA0037: handover failed to restore original claims';
  END IF;
  UPDATE public.cotizaciones SET estado='Aceptada' WHERE id=v_cot;
  IF (SELECT count(*) FROM public.cotizacion_handovers WHERE cotizacion_id=v_cot)<>1
     OR (SELECT embarque_id FROM public.cotizaciones WHERE id=v_cot) IS DISTINCT FROM v_emb THEN
    RAISE EXCEPTION 'QA0037: repeated acceptance changed handover/shipment';
  END IF;
  PERFORM set_config('role','postgres',true);
  IF NOT EXISTS(SELECT 1 FROM public.embarques WHERE id=v_emb AND cotizacion_id=v_cot AND estado='Borrador') THEN
    RAISE EXCEPTION 'QA0037: expected linked draft shipment';
  END IF;
  RAISE NOTICE 'QA0037 PASS: real authenticated send/accept, margin, private ACL, handover, shipment and retry';
END $test$;
ROLLBACK;
