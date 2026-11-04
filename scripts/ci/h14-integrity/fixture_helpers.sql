-- H14 correction fixtures, copied from final isolated characterization b76cfcbabad044f8b1c26a4717292c25.
-- Invoker-only temporary helpers; loading definitions creates no business rows or RPC calls.
-- Historical expected-by-code oracle intentionally removed; regression expectations are independent.
-- H14 finance constructors. Source: 1b9496ff340e8afc2e287ec5a030e1b56e9777f7.
-- PostgreSQL STRICT replay only, owned disposable clone. No project DDL/ACL changes.
-- Definitions are session-local SECURITY INVOKER. Caller controls BEGIN/ROLLBACK.
-- No business RPC executes merely by loading this file.

CREATE FUNCTION pg_temp.h14_fin_assert(p_ok boolean, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_ok IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'H14_FIN_ASSERT: %', p_message;
  END IF;
END $$;

CREATE FUNCTION pg_temp.h14_fin_owner()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
  PERFORM set_config('role', NULL, true);
  RESET ROLE;
END $$;

CREATE FUNCTION pg_temp.h14_fin_actor(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
  PERFORM set_config('role','authenticated',true);
  RETURN jsonb_build_object('current_user',current_user,'session_user',session_user,
    'auth_uid',auth.uid(),'current_user_org_id',public.current_user_org_id(),'org_scope',public.org_scope(),
    'has_role_admin',public.has_role(auth.uid(),'admin'::public.app_role),
    'has_role_operador',public.has_role(auth.uid(),'operador'::public.app_role),
    'has_role_super_admin',public.has_role(auth.uid(),'super_admin'::public.app_role));
END $$;

CREATE FUNCTION pg_temp.h14_fin_assert_actor(p_user uuid,p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM pg_temp.h14_fin_assert(current_user='authenticated' AND auth.uid()=p_user
    AND public.current_user_org_id()=p_org AND public.org_scope()=p_org
    AND public.has_role(auth.uid(),'admin'::public.app_role) IS TRUE
    AND public.has_role(auth.uid(),'operador'::public.app_role) IS TRUE
    AND public.has_role(auth.uid(),'super_admin'::public.app_role) IS FALSE,
    'finance caller must be authenticated admin of expected company, not super_admin');
END $$;

CREATE FUNCTION pg_temp.h14_fin_uuid(p_case text, p_entity text)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER AS $$
  SELECT ('f1400000-'||substr(h,1,4)||'-4'||substr(h,5,3)||'-8'||substr(h,8,3)||'-'||substr(h,11,12))::uuid
  FROM (SELECT md5(coalesce(nullif(current_setting('h14.run_id',true),''),current_database())
    ||':'||p_case||':'||p_entity) h) s;
$$;

CREATE FUNCTION pg_temp.h14_fin_seed(p_case text, p_state text DEFAULT 'Borrador', p_closed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  oa uuid:=pg_temp.h14_fin_uuid(p_case,'org-a'); ob uuid:=pg_temp.h14_fin_uuid(p_case,'org-b');
  ua uuid:=pg_temp.h14_fin_uuid(p_case,'actor-a'); ub uuid:=pg_temp.h14_fin_uuid(p_case,'actor-b');
  ca uuid:=pg_temp.h14_fin_uuid(p_case,'cliente-a'); cb uuid:=pg_temp.h14_fin_uuid(p_case,'cliente-b');
  ea uuid:=pg_temp.h14_fin_uuid(p_case,'embarque-a'); eb uuid:=pg_temp.h14_fin_uuid(p_case,'embarque-b');
  ec uuid:=pg_temp.h14_fin_uuid(p_case,'embarque-control-a');
BEGIN
  PERFORM pg_temp.h14_fin_owner();
  PERFORM pg_temp.h14_fin_assert(current_user=session_user AND current_user='postgres',
    'fixture must be prepared by clone postgres owner, not by tested actor');
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (ua,'finance-'||ua::text||'@example.invalid','{"skip_auto_org":true}'::jsonb),
    (ub,'finance-'||ub::text||'@example.invalid','{"skip_auto_org":true}'::jsonb);
  PERFORM pg_temp.h14_fin_assert((SELECT count(*)=2 FROM auth.users WHERE id IN(ua,ub)),
    'both synthetic auth users must exist; never swallow seed errors');
  INSERT INTO public.organizations(id,nombre) VALUES(oa,'H14 FIN '||p_case||' A'),(ob,'H14 FIN '||p_case||' B');
  INSERT INTO public.organization_members(organization_id,user_id,role)
    VALUES(oa,ua,'admin_org'),(ob,ub,'admin_org');
  -- Assert the mirror made by the REAL membership trigger. Do not repair it.
  PERFORM pg_temp.h14_fin_assert((SELECT count(*)=2 FROM public.organization_members m
    JOIN public.user_roles r ON r.user_id=m.user_id AND r.role=m.role
    WHERE m.user_id IN(ua,ub) AND m.role='admin_org'), 'membership/global modern mirrors must agree');
  PERFORM pg_temp.h14_fin_assert((SELECT count(*)=2 FROM public.organization_members WHERE user_id IN(ua,ub)),
    'exactly one intended membership per actor; no signup auto-org fixture ambiguity');
  INSERT INTO public.clientes(id,organization_id,nombre,email,rfc) VALUES
    (ca,oa,'H14 FIN Cliente A','finance-cliente-'||ca::text||'@example.invalid','XAXX010101000'),
    (cb,ob,'H14 FIN Cliente B','finance-cliente-'||cb::text||'@example.invalid','XAXX010101000');
  INSERT INTO public.embarques(id,organization_id,cliente_id,modo,tipo,estado,expediente,
    tipo_cambio_usd,tipo_cambio_eur,cerrado_at)
    VALUES(ea,oa,ca,'Aéreo','Importación',p_state::public.estado_embarque,NULL,20,22,
      CASE WHEN p_closed THEN now() ELSE NULL END),
      (eb,ob,cb,'Aéreo','Importación','Borrador',NULL,20,22,NULL),
      (ec,oa,ca,'Aéreo','Importación','Borrador',NULL,20,22,NULL);
  -- Another live shipment in A makes accidental same-tenant broad updates observable.
  PERFORM pg_temp.h14_fin_sale(jsonb_build_object('case_key',p_case,'org_a',oa),'control-sale',ec);
  INSERT INTO public.documentos_embarque(id,organization_id,embarque_id,nombre)
    VALUES(pg_temp.h14_fin_uuid(p_case,'control-document'),oa,ec,'H14 control de otra operación A');
  RETURN jsonb_build_object('case_key',p_case,'org_a',oa,'org_b',ob,'actor_a',ua,'actor_b',ub,
    'cliente_a',ca,'cliente_b',cb,'embarque_a',ea,'embarque_b',eb,'target_embarque_id',ea,
    'embarque_control_a',ec,
    'invoice_ids','[]'::jsonb,'proforma_ids','[]'::jsonb,'payment_ids','[]'::jsonb,'credit_ids','[]'::jsonb);
END $$;

CREATE FUNCTION pg_temp.h14_fin_second_shipment(p_f jsonb, p_entity text DEFAULT 'embarque-second', p_state text DEFAULT 'Borrador')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE e uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity);
BEGIN
  INSERT INTO public.embarques(id,organization_id,cliente_id,modo,tipo,estado,expediente,tipo_cambio_usd,tipo_cambio_eur)
    VALUES(e,(p_f->>'org_a')::uuid,(p_f->>'cliente_a')::uuid,'Aéreo','Importación',p_state::public.estado_embarque,NULL,20,22);
  RETURN e;
END $$;

CREATE FUNCTION pg_temp.h14_fin_proforma(p_f jsonb,p_entity text,p_embarque uuid,
  p_state text DEFAULT 'pendiente',p_approval text DEFAULT 'borrador',p_client text DEFAULT 'pendiente',p_amount numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE idp uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity);
BEGIN
  INSERT INTO public.proformas(id,organization_id,numero,cliente_id,cliente_nombre,expediente,embarque_id,
    estado_proforma,estado_aprobacion,estado_cliente,estado_revision,subtotal_mxn,iva_mxn,total_mxn,dias_credito)
  VALUES(idp,(p_f->>'org_a')::uuid,'H14-'||idp::text,(p_f->>'cliente_a')::uuid,'H14 FIN Cliente A',
    'H14-FICTICIO',p_embarque,p_state,p_approval,p_client,'pendiente',p_amount,round(p_amount*.16,2),round(p_amount*1.16,2),15);
  RETURN idp;
END $$;

CREATE FUNCTION pg_temp.h14_fin_sale(p_f jsonb,p_entity text,p_embarque uuid,p_proforma uuid DEFAULT NULL,p_amount numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE x uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity);
BEGIN
  INSERT INTO public.conceptos_venta(id,organization_id,embarque_id,descripcion,cantidad,precio_unitario,total,
    moneda,proforma_id,aplica_iva,tasa_iva_aplicada,tipo_iva,estado_facturacion,origen)
    VALUES(x,(p_f->>'org_a')::uuid,p_embarque,'H14 Ficticio '||p_entity,1,p_amount,p_amount,'MXN',p_proforma,
      true,.16,'gravado_16',CASE WHEN p_proforma IS NULL THEN 'pendiente' ELSE 'en_proforma' END,'manual');
  RETURN x;
END $$;

CREATE FUNCTION pg_temp.h14_fin_seed_dof(p_date date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM pg_temp.h14_fin_assert(current_user='postgres','synthetic DOF fixture must be owner setup only');
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,fuente,origen,fecha_publicacion_usd)
  VALUES(p_date,20,22,'H14_FICTICIO_LOCAL_NO_PUBLICACION_REAL','manual',p_date)
  ON CONFLICT(fecha) DO NOTHING;
  PERFORM pg_temp.h14_fin_assert(EXISTS(SELECT 1 FROM public.tipos_cambio_dof WHERE fecha=p_date
    AND usd_mxn=20 AND eur_mxn=22 AND fuente='H14_FICTICIO_LOCAL_NO_PUBLICACION_REAL' AND origen='manual'),
    'DOF fixture date collision: do not overwrite an existing different catalog row');
END $$;

CREATE FUNCTION pg_temp.h14_fin_invoice(p_f jsonb,p_entity text,p_embarque uuid,
  p_state text DEFAULT 'Borrador',p_currency text DEFAULT 'MXN',p_amount numeric DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE idf uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity);
BEGIN
  IF p_currency<>'MXN' THEN
    -- The real trigger ignores manual FX: supply a fresh fictitious local DOF row.
    PERFORM pg_temp.h14_fin_seed_dof(public.fecha_negocio_mx()-2);
  END IF;
  -- Relational state fixture: no claim of SAT issue/cancel/substitution execution.
  INSERT INTO public.facturas(id,organization_id,numero,cliente_id,cliente_nombre,embarque_id,estado,
    fecha_emision,fecha_vencimiento,moneda,tipo_cambio,subtotal,iva,total,metodo_pago,forma_pago)
  VALUES(idf,(p_f->>'org_a')::uuid,'H14-'||idf::text,(p_f->>'cliente_a')::uuid,'H14 FIN Cliente A',
    p_embarque,'Borrador',public.fecha_negocio_mx()-2,public.fecha_negocio_mx()+15,
    p_currency::public.moneda,CASE p_currency WHEN 'MXN' THEN 1 WHEN 'USD' THEN 20 ELSE 22 END,0,0,0,'PPD','99');
  INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,descripcion,cantidad,
    precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
  VALUES(pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-concepto'),(p_f->>'org_a')::uuid,idf,
    p_embarque,'H14 Concepto ficticio',1,p_amount,p_amount,p_currency::public.moneda,'tasa_0',0);
  IF p_state <> 'Borrador' THEN
    UPDATE public.facturas SET estado=(CASE WHEN p_state='Pagada' THEN 'Emitida' ELSE p_state END)::public.estado_factura WHERE id=idf;
    IF p_state='Pagada' THEN
      PERFORM pg_temp.h14_fin_customer_payment(p_f,p_entity||'-pago-total',idf,p_amount);
    END IF;
  END IF;
  RETURN idf;
END $$;

CREATE FUNCTION pg_temp.h14_fin_customer_payment(p_f jsonb,p_entity text,p_factura uuid,p_amount numeric DEFAULT 10)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE x uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity); m public.moneda;
BEGIN
  SELECT moneda INTO STRICT m FROM public.facturas WHERE id=p_factura;
  INSERT INTO public.pagos_factura(id,organization_id,factura_id,fecha_pago,monto,moneda,tipo_cambio,monto_aplicado_factura)
  VALUES(x,(p_f->>'org_a')::uuid,p_factura,public.fecha_negocio_mx()-1,p_amount,m,
    CASE m::text WHEN 'MXN' THEN 1 WHEN 'USD' THEN 20 ELSE 22 END,p_amount);
  RETURN x;
END $$;

CREATE FUNCTION pg_temp.h14_fin_customer_credit(p_f jsonb,p_entity text,p_factura uuid,p_cancelled boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE x uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity); m public.moneda;
BEGIN
  SELECT moneda INTO STRICT m FROM public.facturas WHERE id=p_factura;
  INSERT INTO public.factura_notas_credito(id,organization_id,factura_id,folio,monto,moneda,tipo_cambio,
    estado,fecha_emision,conceptos)
  VALUES(x,(p_f->>'org_a')::uuid,p_factura,'H14-'||x::text,5,m,
    CASE m::text WHEN 'MXN' THEN 1 WHEN 'USD' THEN 20 ELSE 22 END,'Borrador',public.fecha_negocio_mx()-1,'[]');
  IF p_cancelled THEN UPDATE public.factura_notas_credito SET estado='Cancelada' WHERE id=x; END IF;
  RETURN x;
END $$;

CREATE FUNCTION pg_temp.h14_fin_supplier_invoice(p_f jsonb,p_entity text,p_state text DEFAULT 'Vigente',p_amount numeric DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE x uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity);
  prov uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-proveedor');
  cat uuid:=pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-categoria');
BEGIN
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
    VALUES(prov,(p_f->>'org_a')::uuid,'H14 Proveedor ficticio','Logistico','Transportista');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre,tipo_contable)
    VALUES(cat,(p_f->>'org_a')::uuid,'H14 Categoria ficticia '||cat::text,'CostoDirectoEmbarque');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    folio_proveedor,embarque_id,subtotal,iva,total,moneda,tipo_cambio_usd,estado,estado_aprobacion,fecha_emision)
  VALUES(x,(p_f->>'org_a')::uuid,prov,cat,'H14-'||x::text,(p_f->>'embarque_a')::uuid,
    p_amount,0,p_amount,'MXN',20,CASE WHEN p_state='Cancelada' THEN 'Cancelada'::public.estado_proveedor_factura ELSE 'Vigente'::public.estado_proveedor_factura END,
    CASE WHEN p_state='Cancelada' THEN 'pendiente'::public.estado_aprobacion_factura_proveedor ELSE 'aprobada'::public.estado_aprobacion_factura_proveedor END,
    public.fecha_negocio_mx());
  -- Cancelada is a residual relational fixture: INSERT under real constraints,
  -- NOT an assertion that the normal cancellation RPC preserves embarque_id.
  IF p_state='Pagada' THEN
    -- Produce calculated state through a real fictitious local payment row.
    INSERT INTO public.cuentas_bancarias(id,organization_id,alias,moneda,activa,fecha_saldo_inicial)
    VALUES(pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-cuenta'),(p_f->>'org_a')::uuid,'H14 ficticia','MXN',true,public.fecha_negocio_mx()-5);
    INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,cuenta_bancaria_id)
    VALUES(pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-pago'),(p_f->>'org_a')::uuid,x,
      public.fecha_negocio_mx(),p_amount,'MXN',pg_temp.h14_fin_uuid(p_f->>'case_key',p_entity||'-cuenta'));
  ELSIF p_state NOT IN('Vigente','Cancelada') THEN RAISE EXCEPTION 'H14 invalid supplier fixture state %',p_state;
  END IF;
  RETURN x;
END $$;

CREATE FUNCTION pg_temp.h14_fin_snapshot(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE t text; rows jsonb; result jsonb:='{}';
BEGIN
  PERFORM pg_temp.h14_fin_assert(current_user='postgres','snapshot must run as owner');
  FOREACH t IN ARRAY ARRAY['embarques','conceptos_venta','conceptos_costo','documentos_embarque',
    'notas_embarque','eventos_embarque','embarque_contenedores','seguros_embarque','cotizaciones',
    'facturas','conceptos_factura','factura_embarques','proformas','proforma_conceptos_consolidados',
    'pagos_factura','factura_notas_credito','proveedor_facturas','proveedor_facturas_conceptos',
    'pagos_proveedor','proveedor_notas_credito','comisiones_devengadas','comisiones_recalculo_pendiente',
    'liquidaciones_comision','bbva_movimientos','embarque_facturas_entrantes','embarque_facturas_entrantes_conceptos','embarque_garantias_contenedor','embarque_garantias_historial','bitacora_actividad','notificaciones_cliente','notificaciones_internas'] LOOP
    PERFORM pg_temp.h14_fin_assert(to_regclass(format('public.%I',t)) IS NOT NULL,
      'snapshot inventory relation missing: public.'||t||'; do not omit this category');
    PERFORM pg_temp.h14_fin_assert(EXISTS(SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=to_regclass(format('public.%I',t)) AND a.attname='organization_id'
        AND a.attnum>0 AND NOT a.attisdropped),
      'snapshot inventory lacks tenant column: public.'||t||'.organization_id');
    EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(''row'',to_jsonb(x),''ctid'',x.ctid::text,''xmin'',x.xmin::text) ORDER BY to_jsonb(x)::text),''[]''::jsonb) FROM public.%I x WHERE organization_id=$1',t)
      INTO rows USING p_org;
    result:=result||jsonb_build_object(t,rows);
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.h14_fin_financial(p_snapshot jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER AS $$
  SELECT coalesce(jsonb_object_agg(k,v),'{}'::jsonb) FROM jsonb_each(p_snapshot) j(k,v)
  WHERE k=ANY(ARRAY['facturas','conceptos_factura','factura_embarques','proformas','proforma_conceptos_consolidados',
    'pagos_factura','factura_notas_credito','proveedor_facturas','proveedor_facturas_conceptos','pagos_proveedor',
    'proveedor_notas_credito','comisiones_devengadas','comisiones_recalculo_pendiente','liquidaciones_comision','bbva_movimientos','embarque_facturas_entrantes','embarque_facturas_entrantes_conceptos','embarque_garantias_contenedor','embarque_garantias_historial']);
$$;

CREATE FUNCTION pg_temp.h14_fin_other_operatives(p_snapshot jsonb,p_target uuid,p_allowed_quote uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER AS $$
  SELECT coalesce(jsonb_object_agg(k,filtered),'{}'::jsonb) FROM (
    SELECT k,(SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]'::jsonb) FROM jsonb_array_elements(v) x
      WHERE CASE WHEN k='embarques' THEN (x->'row'->>'id')::uuid IS DISTINCT FROM p_target
        WHEN k='cotizaciones' THEN (x->'row'->>'id')::uuid IS DISTINCT FROM p_allowed_quote
        ELSE (x->'row'->>'embarque_id')::uuid IS DISTINCT FROM p_target END) filtered
    FROM jsonb_each(p_snapshot) j(k,v)
    WHERE k=ANY(ARRAY['embarques','conceptos_venta','conceptos_costo','documentos_embarque','notas_embarque',
      'eventos_embarque','embarque_contenedores','seguros_embarque','cotizaciones'])
  ) s;
$$;

CREATE FUNCTION pg_temp.h14_fin_fixture(p_case text,p_variant text DEFAULT 'base')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  f jsonb; key text:=p_case||'.'||p_variant; oa uuid; ea uuid; target uuid; e2 uuid;
  inv uuid; inv2 uuid; pro uuid; pro2 uuid; x uuid; pay uuid; nc uuid; q uuid;
  samples uuid[]; samples_after uuid[]; outside uuid; ids uuid[]:=ARRAY[]::uuid[]; caller jsonb;
  n int; currency text; amount numeric; kind text:='relational_fixture_owner';
BEGIN
  IF p_case='H01' THEN
    f:=pg_temp.h14_fin_seed(key,CASE WHEN p_variant='cerrado' THEN 'Cerrado' ELSE 'Confirmado' END,p_variant='cerrado_at');
    IF p_variant='cerrado_at' THEN kind:='historical_inconsistent_timestamp_owner'; END IF;
  ELSIF p_case='H04' THEN f:=pg_temp.h14_fin_seed(key,'Cancelado');
  ELSIF p_case='L05' THEN f:=pg_temp.h14_fin_seed(key,'Confirmado');
  ELSE f:=pg_temp.h14_fin_seed(key); END IF;
  oa:=(f->>'org_a')::uuid; ea:=(f->>'embarque_a')::uuid; target:=ea;
  CASE p_case
    WHEN 'X01','X02','X08' THEN
      e2:=pg_temp.h14_fin_second_shipment(f); target:=e2;
      inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice','Vigente',CASE WHEN p_case='X02' THEN 0 ELSE 100 END);
      x:=pg_temp.h14_fin_uuid(key,'linked-cost');
      INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
        SELECT x,oa,e2,pf.proveedor_id,'H14 linked fictitious cost',CASE WHEN p_case='X02' THEN 0 ELSE 100 END,'MXN'
        FROM public.proveedor_facturas pf WHERE pf.id=inv;
      INSERT INTO public.proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
        VALUES(pg_temp.h14_fin_uuid(key,'supplier-concept'),oa,inv,x,'H14 linked cost',1,CASE WHEN p_case='X02' THEN 0 ELSE 100 END);
      IF p_case='X08' THEN UPDATE public.conceptos_costo SET deleted_at=now() WHERE id=x; END IF;
      f:=f||jsonb_build_object('second_embarque_id',e2,'supplier_invoice_ids',jsonb_build_array(inv),'linked_cost_id',x);
      inv:=NULL;
    WHEN 'X09' THEN
      e2:=pg_temp.h14_fin_second_shipment(f);target:=e2;
      inv:=pg_temp.h14_fin_invoice(f,'invoice-header',ea,'Emitida');
      pay:=pg_temp.h14_fin_customer_payment(f,'direct-payment',inv);
      PERFORM pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
      PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
      UPDATE public.pagos_factura SET embarque_id=e2 WHERE id=pay;
      PERFORM pg_temp.h14_fin_owner();
      PERFORM pg_temp.h14_fin_assert((SELECT embarque_id=e2 AND factura_id=inv FROM public.pagos_factura WHERE id=pay),'direct payment target must remain independent from invoice header');
      f:=f||jsonb_build_object('second_embarque_id',e2);
    WHEN 'X10' THEN
      e2:=pg_temp.h14_fin_second_shipment(f);target:=e2;
      inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice');
      x:=pg_temp.h14_fin_uuid(key,'incoming-document');
      INSERT INTO public.embarque_facturas_entrantes(id,organization_id,embarque_id,archivo_path,archivo_hash,nombre_archivo,estado)
        VALUES(x,oa,e2,oa::text||'/h14-fictitious-no-upload.pdf',repeat('a',64),'H14 fictitious no file uploaded','por_capturar');
      caller:=pg_temp.h14_fin_actor((f->>'actor_a')::uuid);PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
      PERFORM public.capturar_factura_entrante(x,inv);PERFORM pg_temp.h14_fin_owner();
      PERFORM pg_temp.h14_fin_assert((SELECT estado='capturada' AND proveedor_factura_id=inv FROM public.embarque_facturas_entrantes WHERE id=x),'real local incoming capture must preserve its supplier link');
      f:=f||jsonb_build_object('second_embarque_id',e2,'supplier_invoice_ids',jsonb_build_array(inv),'incoming_capture_actor',caller,'incoming_document_id',x);inv:=NULL;
    WHEN 'X11' THEN
      e2:=pg_temp.h14_fin_second_shipment(f);target:=e2;
      inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice');
      x:=pg_temp.h14_fin_uuid(key,'container');
      INSERT INTO public.embarque_contenedores(id,organization_id,embarque_id,numero_contenedor) VALUES(x,oa,e2,'FICT0000001');
      INSERT INTO public.embarque_garantias_contenedor(id,organization_id,embarque_id,embarque_contenedor_id,proveedor_factura_id,monto_deposito_usd,estado)
        VALUES(pg_temp.h14_fin_uuid(key,'linked-guarantee'),oa,e2,x,inv,0,'pendiente');
      f:=f||jsonb_build_object('second_embarque_id',e2,'supplier_invoice_ids',jsonb_build_array(inv));inv:=NULL;
    WHEN 'X12','X13' THEN
      FOR n IN 1..21 LOOP ids:=array_append(ids,pg_temp.h14_fin_invoice(f,'full-count-invoice-'||n::text,ea,'Emitida')); END LOOP;
      PERFORM pg_temp.h14_fin_actor((f->>'actor_a')::uuid);PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
      SELECT array_agg((r->>'id')::uuid) INTO samples FROM jsonb_array_elements(public.diagnosticar_baja_embarque(ea)->'ejemplos_cxc') r;
      PERFORM pg_temp.h14_fin_owner();
      PERFORM pg_temp.h14_fin_assert(array_length(samples,1)=20,'canonical examples must actually expose a limited sample');
      SELECT id INTO STRICT outside FROM public.facturas WHERE id=ANY(ids) AND NOT(id=ANY(samples));
      IF p_case='X12' THEN pay:=pg_temp.h14_fin_customer_payment(f,'outside-canonical-examples',outside);
      ELSE nc:=pg_temp.h14_fin_customer_credit(f,'outside-canonical-examples',outside);END IF;
      f:=f||jsonb_build_object('outside_canonical_examples_id',outside,'sample_canonical_before_child',to_jsonb(samples));
    WHEN 'X03' THEN
      inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice');
      INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,prima,moneda,
        vigencia_desde,vigencia_hasta,proveedor_factura_id)
        VALUES(pg_temp.h14_fin_uuid(key,'linked-insurance'),oa,ea,'H14 fictitious','H14 linked insurance',100,'MXN',
          public.fecha_negocio_mx(),public.fecha_negocio_mx()+1,inv);
      f:=f||jsonb_build_object('supplier_invoice_ids',jsonb_build_array(inv)); inv:=NULL;
    WHEN 'X04','X05' THEN
      e2:=pg_temp.h14_fin_second_shipment(f); target:=e2;
      pro:=pg_temp.h14_fin_proforma(f,'proforma-header',ea,'pendiente','aprobada','pendiente');
      IF p_case='X04' THEN
        INSERT INTO public.proforma_conceptos_consolidados(id,organization_id,proforma_id,embarque_id,descripcion,
          cantidad,precio_unitario,total,moneda,aplica_iva,iva,tipo_iva,tasa_iva_aplicada)
          VALUES(pg_temp.h14_fin_uuid(key,'consolidated-concept'),oa,pro,e2,'H14 source of another shipment',1,0,0,'MXN',false,0,'tasa_0',0);
      ELSE
        PERFORM pg_temp.h14_fin_sale(f,'source-sale',e2,pro,0);
      END IF;
      f:=f||jsonb_build_object('second_embarque_id',e2);
    WHEN 'X06' THEN
      e2:=pg_temp.h14_fin_second_shipment(f); target:=e2;
      inv:=pg_temp.h14_fin_invoice(f,'invoice-header',ea);
      pro:=pg_temp.h14_fin_proforma(f,'source-proforma',e2,'facturada','aprobada','aceptada');
      INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,proforma_id_origen,
        descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
        VALUES(pg_temp.h14_fin_uuid(key,'invoice-source-only'),oa,inv,NULL,pro,'H14 source lineage only',1,0,0,'MXN','tasa_0',0);
      f:=f||jsonb_build_object('second_embarque_id',e2);
    WHEN 'X07' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea);
      INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa)
        VALUES(inv,ea,oa,true) ON CONFLICT DO NOTHING;
      pro:=pg_temp.h14_fin_proforma(f,'source-proforma',ea,'facturada','aprobada','aceptada');
      UPDATE public.proformas SET factura_id=inv WHERE id=pro;
      PERFORM pg_temp.h14_fin_sale(f,'source-sale',ea,pro,0);
      INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,proforma_id_origen,
        descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
        VALUES(pg_temp.h14_fin_uuid(key,'invoice-concept'),oa,inv,ea,pro,'H14 redundant active paths',1,0,0,'MXN','tasa_0',0);
    WHEN 'B01' THEN NULL;
    WHEN 'B02' THEN
      q:=pg_temp.h14_fin_uuid(key,'cotizacion');
      INSERT INTO public.cotizaciones(id,organization_id,folio,cliente_id,modo,tipo,estado)
      VALUES(q,oa,'H14-'||q::text,(f->>'cliente_a')::uuid,'Aéreo','Importación','Aceptada');
      UPDATE public.embarques SET cotizacion_id=q WHERE id=ea;
      UPDATE public.cotizaciones SET embarque_id=ea,estado='En operación' WHERE id=q;
      PERFORM pg_temp.h14_fin_sale(f,'sale',ea);
      INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,concepto,monto,moneda)
      VALUES(pg_temp.h14_fin_uuid(key,'cost'),oa,ea,'H14 costo ficticio',0,'MXN');
      INSERT INTO public.documentos_embarque(id,organization_id,embarque_id,nombre)
      VALUES(pg_temp.h14_fin_uuid(key,'document'),oa,ea,'H14 documento ficticio sin archivo');
      INSERT INTO public.notas_embarque(id,organization_id,embarque_id,contenido)
      VALUES(pg_temp.h14_fin_uuid(key,'note'),oa,ea,'H14 nota ficticia');
      INSERT INTO public.eventos_embarque(id,organization_id,embarque_id,tipo,descripcion)
      VALUES(pg_temp.h14_fin_uuid(key,'event'),oa,ea,'Otro','H14 evento ficticio');
      INSERT INTO public.embarque_contenedores(id,organization_id,embarque_id,numero_contenedor)
      VALUES(pg_temp.h14_fin_uuid(key,'container'),oa,ea,'FICT1234567');
      INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,vigencia_desde,vigencia_hasta)
      VALUES(pg_temp.h14_fin_uuid(key,'insurance'),oa,ea,'H14 ficticia','H14-'||key,public.fecha_negocio_mx(),public.fecha_negocio_mx()+1);
      f:=f||jsonb_build_object('cotizacion_id',q);
    WHEN 'L01' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,CASE WHEN p_variant='issued' THEN 'Emitida' ELSE 'Borrador' END);
    WHEN 'L02','L03' THEN
      e2:=pg_temp.h14_fin_second_shipment(f); target:=e2;
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,CASE WHEN p_case='L02' THEN 'Emitida' ELSE 'Borrador' END);
      INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa)
        VALUES(inv,ea,oa,true),(inv,e2,oa,p_variant<>'inactive') ON CONFLICT DO NOTHING;
      PERFORM pg_temp.h14_fin_assert(EXISTS(SELECT 1 FROM public.factura_embarques
        WHERE factura_id=inv AND embarque_id=e2 AND activa=(p_variant<>'inactive')),
        'bridge fixture must preserve the requested real active/inactive value');
      IF p_case='L02' THEN
        pro:=pg_temp.h14_fin_proforma(f,'proforma-first',ea,'facturada','aprobada','aceptada');
        pro2:=pg_temp.h14_fin_proforma(f,'proforma-second',e2,'facturada','aprobada','aceptada');
        UPDATE public.proformas SET factura_id=inv WHERE id IN(pro,pro2);
        pay:=pg_temp.h14_fin_customer_payment(f,'payment',inv);
        nc:=pg_temp.h14_fin_customer_credit(f,'credit',inv);
      END IF;
      f:=f||jsonb_build_object('second_embarque_id',e2,'bridge_active',p_variant<>'inactive');
    WHEN 'L04' THEN
      e2:=pg_temp.h14_fin_second_shipment(f); target:=e2;
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea);
      INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
      VALUES(pg_temp.h14_fin_uuid(key,'concept-target'),oa,inv,e2,'H14 concepto de otro embarque',1,20,20,'MXN','tasa_0',0);
      PERFORM pg_temp.h14_fin_assert(NOT EXISTS(SELECT 1 FROM public.factura_embarques WHERE factura_id=inv AND embarque_id=e2),
        'L04 needs a concept link without target bridge; do not delete a bridge created by real triggers');
      f:=f||jsonb_build_object('second_embarque_id',e2);
    WHEN 'L05' THEN
      e2:=pg_temp.h14_fin_second_shipment(f,'embarque-second','Confirmado'); target:=e2;
      pro:=pg_temp.h14_fin_proforma(f,'proforma-first',ea,'pendiente','aprobada','aceptada',100);
      pro2:=pg_temp.h14_fin_proforma(f,'proforma-second',e2,'pendiente','aprobada','aceptada',100);
      -- Explicit source ordering is a fixture fact, never infer order from random UUID.
      UPDATE public.proformas SET created_at=now()-interval '2 minutes' WHERE id=pro;
      UPDATE public.proformas SET created_at=now()-interval '1 minute' WHERE id=pro2;
      PERFORM pg_temp.h14_fin_sale(f,'sale-first',ea,pro,100);
      PERFORM pg_temp.h14_fin_sale(f,'sale-second',e2,pro2,100);
      x:=pg_temp.h14_fin_uuid(key,'series');
      INSERT INTO public.factura_series(id,organization_id,codigo,prefijo,activa)
        VALUES(x,oa,'H14','H14',true);
      kind:='producer_pending_execution';
      f:=f||jsonb_build_object('second_embarque_id',e2,'series_id',x,'operation','convert_then_delete',
        'producer_request_id',pg_temp.h14_fin_uuid(key,'producer-request'));
    WHEN 'E01' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,CASE WHEN p_variant='cancelada' THEN 'Cancelada' ELSE 'Sustituida' END);
    WHEN 'E02' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,CASE WHEN p_variant='pagada' THEN 'Pagada' ELSE 'Emitida' END,
        'MXN',CASE WHEN p_variant='cero' THEN 0 ELSE 100 END);
    WHEN 'E03' THEN
      inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice',CASE WHEN p_variant='cancelada' THEN 'Cancelada' ELSE 'Pagada' END);
      f:=f||jsonb_build_object('supplier_invoice_ids',jsonb_build_array(inv)); inv:=NULL;
      IF p_variant='cancelada' THEN kind:='residual_cancelled_supplier_header_owner_not_normal_cancellation_rpc'; END IF;
    WHEN 'E04' THEN
      pro:=pg_temp.h14_fin_proforma(f,'proforma',ea,'pendiente',p_variant,'pendiente');
    WHEN 'E05' THEN
      pro:=pg_temp.h14_fin_proforma(f,'proforma',ea,p_variant,'aprobada','aceptada');
      kind:='relational_state_fixture_no_invoice_producer';
    WHEN 'E06' THEN
      IF p_variant='factura_null' THEN
        inv:=pg_temp.h14_fin_invoice(f,'invoice',ea);
        UPDATE public.facturas SET estado=NULL WHERE id=inv;
      ELSIF p_variant='proforma_null' THEN
        pro:=pg_temp.h14_fin_proforma(f,'proforma',ea);
        UPDATE public.proformas SET estado_proforma=NULL WHERE id=pro;
      ELSE
        inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice');
        UPDATE public.proveedor_facturas SET estado=NULL WHERE id=inv;
      END IF;
      RAISE EXCEPTION 'H14 unexpected nullable state accepted';
    WHEN 'E07' THEN
      IF p_variant LIKE 'cxc_%' THEN
        inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,'Emitida');
        nc:=pg_temp.h14_fin_customer_credit(f,'credit',inv,true);
        UPDATE public.facturas SET estado='Cancelada' WHERE id=inv;
        IF p_variant='cxc_deleted' THEN UPDATE public.factura_notas_credito SET deleted_at=now() WHERE id=nc; END IF;
      ELSE
        inv:=pg_temp.h14_fin_supplier_invoice(f,'supplier-invoice');
        nc:=pg_temp.h14_fin_uuid(key,'supplier-credit');
        INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,folio_nc,monto,subtotal,
          moneda,tipo_cambio_mxn,estado,fecha)
        VALUES(nc,oa,inv,'H14-'||nc::text,5,5,'MXN',1,'Borrador',public.fecha_negocio_mx());
        UPDATE public.proveedor_notas_credito SET estado='Cancelada' WHERE id=nc;
        IF p_variant='cxp_deleted' THEN UPDATE public.proveedor_notas_credito SET deleted_at=now() WHERE id=nc; END IF;
        f:=f||jsonb_build_object('supplier_invoice_ids',jsonb_build_array(inv)); inv:=NULL;
      END IF;
    WHEN 'E08' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,'Emitida');
      IF p_variant='payment' THEN pay:=pg_temp.h14_fin_customer_payment(f,'payment',inv);
      ELSE nc:=pg_temp.h14_fin_customer_credit(f,'credit',inv); END IF;
      -- Intentionally probe actual parent guard. Do NOT disable it or force the history.
      UPDATE public.facturas SET deleted_at=now() WHERE id=inv;
      kind:='parent_deleted_with_live_child_if_constraints_allow';
    WHEN 'P01' THEN
      FOR n IN 1..21 LOOP ids:=array_append(ids,pg_temp.h14_fin_invoice(f,'invoice-'||n::text,ea,'Emitida')); END LOOP;
      caller:=pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
      PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
      SELECT array_agg(z.id) INTO samples FROM(SELECT id FROM public.facturas WHERE embarque_id=ea AND deleted_at IS NULL LIMIT 20) z;
      PERFORM pg_temp.h14_fin_owner();
      SELECT id INTO STRICT outside FROM public.facturas WHERE embarque_id=ea AND NOT(id=ANY(samples)) LIMIT 1;
      IF p_variant='payment' THEN pay:=pg_temp.h14_fin_customer_payment(f,'payment-outside',outside);
      ELSE nc:=pg_temp.h14_fin_customer_credit(f,'credit-outside',outside); END IF;
      PERFORM pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
      PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,oa);
      SELECT array_agg(z.id) INTO samples_after FROM(SELECT id FROM public.facturas WHERE embarque_id=ea AND deleted_at IS NULL LIMIT 20) z;
      PERFORM pg_temp.h14_fin_owner();
      f:=f||jsonb_build_object('sample_caller',caller,'sample_before',to_jsonb(samples),'sample_after',to_jsonb(samples_after),
        'child_parent_id',outside,'outside_observed_after_child',NOT(outside=ANY(samples_after)));
    WHEN 'P02' THEN
      FOREACH currency IN ARRAY ARRAY['MXN','USD','EUR'] LOOP
        FOREACH amount IN ARRAY ARRAY[0::numeric,100::numeric] LOOP
          ids:=array_append(ids,pg_temp.h14_fin_invoice(f,'invoice-'||currency||'-'||amount::text,ea,'Borrador',currency,amount));
        END LOOP;
      END LOOP;
      f:=f||jsonb_build_object('synthetic_dof_date',public.fecha_negocio_mx()-2,
        'synthetic_dof_source','H14_FICTICIO_LOCAL_NO_PUBLICACION_REAL');
    WHEN 'H01','H04' THEN NULL;
    WHEN 'H02' THEN
      inv:=pg_temp.h14_fin_invoice(f,'invoice',ea,'Emitida');
      pay:=pg_temp.h14_fin_customer_payment(f,'payment',inv);
      x:=pg_temp.h14_fin_uuid(key,'commission');
      -- All three FKs are real and coherent; other financial blockers remain visible.
      INSERT INTO public.comisiones_devengadas(id,organization_id,pago_factura_id,factura_id,embarque_id,
        definitiva,comision_mxn,porcentaje_aplicado,estado,deleted_at)
      VALUES(x,oa,pay,inv,ea,p_variant<>'no_definitiva',0,0,'Devengada',CASE WHEN p_variant='definitiva_borrada' THEN now() ELSE NULL END)
      ON CONFLICT(pago_factura_id) DO UPDATE SET definitiva=EXCLUDED.definitiva,
        deleted_at=EXCLUDED.deleted_at,comision_mxn=0,porcentaje_aplicado=0;
      PERFORM pg_temp.h14_fin_assert(EXISTS(SELECT 1 FROM public.comisiones_devengadas
        WHERE pago_factura_id=pay AND factura_id=inv AND embarque_id=ea AND organization_id=oa),
        'commission parents and target must remain coherent under real constraints');
      f:=f||jsonb_build_object('commission_payment_id',pay);
    ELSE RAISE EXCEPTION 'H14 unknown fixture %',p_case;
  END CASE;
  IF inv IS NOT NULL THEN ids:=array_append(ids,inv); END IF;
  RETURN f||jsonb_build_object('case_id',p_case||'.'||p_variant,'matrix_id',p_case,'variant',p_variant,
    'fixture_class',kind,'target_embarque_id',target,'invoice_ids',to_jsonb(ids),
    'proforma_ids',to_jsonb(array_remove(ARRAY[pro,pro2],NULL)),
    'payment_ids',to_jsonb(array_remove(ARRAY[pay],NULL)),
    'credit_ids',to_jsonb(array_remove(ARRAY[nc],NULL)),
    'expected_context',jsonb_build_object('current_user','authenticated','auth_uid',f->>'actor_a',
      'current_user_org_id',oa,'org_scope',oa,'has_role',jsonb_build_object('admin',true,'operador',true,'super_admin',false)),
    'policy_pending',true,'not_a_recommendation_to_cancel_or_delete',true);
END $$;

CREATE FUNCTION pg_temp.h14_fin_delete(p_actor uuid,p_target uuid,p_org uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE caller jsonb; st text:='00000'; msg text; hint text; detail text; et text; ec text; en text;
BEGIN
  caller:=pg_temp.h14_fin_actor(p_actor);
  PERFORM pg_temp.h14_fin_assert_actor(p_actor,p_org);
  BEGIN
    PERFORM public.eliminar_embarque_completo(p_target);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS st=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,
      et=TABLE_NAME,ec=COLUMN_NAME,en=CONSTRAINT_NAME;
  END;
  PERFORM pg_temp.h14_fin_owner();
  RETURN jsonb_build_object('caller',caller,'sqlstate',st,'message',msg,'hint',hint,'detail',detail,
    'table_name',et,'column_name',ec,'constraint_name',en);
END $$;
