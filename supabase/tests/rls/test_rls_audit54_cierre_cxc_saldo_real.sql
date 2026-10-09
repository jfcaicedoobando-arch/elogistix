-- AUD54/AUD139 composition: monetary customer debt blocks shipment closure.
-- Only fictitious fixtures in ephemeral CI PostgreSQL; every effect rolls back.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  embarque uuid;
  fac uuid;
  pago uuid;
  nc uuid;
  caso record;
  caso_indice integer := 0;
  check_row jsonb;
  money_row jsonb;
  before_facts jsonb;
  after_facts jsonb;
  err text;
  metadata record;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD54-CIERRE-CXC');
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,origen)
  VALUES(hoy,20,'manual') ON CONFLICT(fecha) DO UPDATE SET usd_mxn=EXCLUDED.usd_mxn;
  INSERT INTO public.clientes(id,organization_id,nombre,rfc,email)
  VALUES(cli,fx.org_a,'AUD54 closure','XAXX010101000','aud54-closure@example.invalid');

  FOR caso IN SELECT * FROM (VALUES
    ('cent-MXN', 'MXN', 1.16::numeric, 1.15::numeric, 'MXN', false, false, false, NULL::text, 0.01::numeric, false, 1),
    ('zero-MXN', 'MXN', 1.16, 1.16, 'MXN', false, false, false, NULL, 0, true, 0),
    ('historical-Pagada-cent', 'MXN', 1.16, 1.15, 'MXN', true, false, false, NULL, 0.01, false, 1),
    ('legacy-Pagada-no-evidence', 'MXN', 1.16, NULL, 'MXN', true, false, false, NULL, 0, true, 0),
    ('legacy-Pagada-canceled-only', 'MXN', 1.16, NULL, 'MXN', true, true, false, NULL, 0, true, 0),
    ('legacy-Pagada-deleted-only', 'MXN', 1.16, NULL, 'MXN', true, false, true, NULL, 0, true, 0),
    ('active-plus-canceled', 'MXN', 1.16, 1.15, 'MXN', true, true, false, NULL, 0.01, false, 1),
    ('active-plus-deleted', 'MXN', 1.16, 1.15, 'MXN', true, false, true, NULL, 0.01, false, 1),
    ('cent-USD-payment-MXN', 'USD', 1.16, 23, 'MXN', true, false, false, NULL, 0.01, false, 1),
    ('half-cent-USD-payment-MXN', 'USD', 1.16, 23.10, 'MXN', true, false, false, NULL, 0.01, false, 1),
    ('subcent-USD-payment-MXN', 'USD', 1.16, 23.11, 'MXN', true, false, false, NULL, 0, true, 0),
    ('NC-Borrador-not-netted', 'MXN', 116, 95.99, 'MXN', false, false, false, 'Borrador', 20.01, false, 1),
    ('NC-Timbrada-converted', 'MXN', 116, 95.99, 'MXN', true, false, false, 'Timbrada', 0.01, false, 1),
    ('NC-Aplicada-converted', 'MXN', 116, 95.99, 'MXN', true, false, false, 'Aplicada', 0.01, false, 1),
    ('NC-Cancelada-not-netted', 'MXN', 116, 95.99, 'MXN', false, false, false, 'Cancelada', 20.01, false, 1),
    ('NC-Timbrada-zero', 'MXN', 116, 96, 'MXN', true, false, false, 'Timbrada', 0, true, 0)
  ) AS c(nombre,moneda,total,monto_pago,moneda_pago,historica,pago_cancelado,pago_borrado,
    estado_nc,saldo_esperado,ok_esperado,pendientes_esperados) LOOP
    PERFORM pg_temp.as_postgres();
    embarque := gen_random_uuid(); fac := gen_random_uuid();
    caso_indice := caso_indice + 1;
    INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(embarque,fx.org_a,cli,'ELCXC54'||lpad(caso_indice::text,3,'0'),'Aéreo','Importación');
    INSERT INTO public.facturas(id,organization_id,cliente_id,cliente_nombre,embarque_id,numero,
      fecha_emision,fecha_vencimiento,moneda,tipo_cambio,subtotal,iva,total,estado,metodo_pago)
    VALUES(fac,fx.org_a,cli,'Fixture',embarque,'AUD54-CXC-'||caso.nombre,hoy,hoy+30,
      caso.moneda::public.moneda,CASE WHEN caso.moneda='USD' THEN 20 ELSE 1 END,
      caso.total/1.16,caso.total-caso.total/1.16,caso.total,'Emitida','PPD');
    IF caso.estado_nc IS NOT NULL THEN
      nc := gen_random_uuid();
      INSERT INTO public.factura_notas_credito(id,organization_id,factura_id,folio,monto,moneda,
        tipo_cambio,estado,uuid_fiscal)
      VALUES(nc,fx.org_a,fac,'AUD54-CXC-'||caso.nombre,1,'USD',20,
        caso.estado_nc::public.estado_nota_credito,nc::text);
    END IF;
    PERFORM pg_temp.as_user(fx.admin_a);
    IF caso.pago_cancelado OR caso.pago_borrado THEN
      INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,
        tipo_cambio,forma_pago,estado_rep,deleted_at,monto_aplicado_factura)
      VALUES(fac,fx.org_a,hoy,0.50,caso.moneda::public.moneda,
        CASE WHEN caso.moneda='USD' THEN 20 ELSE 1 END,'Transferencia',
        CASE WHEN caso.pago_cancelado THEN 'Cancelado' ELSE 'NoAplica' END,
        CASE WHEN caso.pago_borrado THEN now() ELSE NULL END,0.50);
    END IF;
    IF caso.monto_pago IS NOT NULL THEN
      INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,
        tipo_cambio,forma_pago,estado_rep)
      VALUES(fac,fx.org_a,hoy,caso.monto_pago,caso.moneda_pago::public.moneda,
        CASE WHEN caso.moneda='USD' THEN 20 ELSE 1 END,'Transferencia','NoAplica') RETURNING id INTO pago;
    END IF;
    IF caso.historica THEN
      -- Same rollback-only historical-state fixture as the AUD54 core candidate.
      -- No disabled trigger: preserve the existing authorized recalculation guard.
      PERFORM pg_temp.as_postgres();
      PERFORM set_config('app.recalc_estado_factura','1',true);
      UPDATE public.facturas SET estado='Pagada',metodo_pago='PUE' WHERE id=fac;
      PERFORM set_config('app.recalc_estado_factura','',true);
      PERFORM pg_temp.as_user(fx.admin_a);
    END IF;
    SELECT jsonb_build_object(
      'invoice',(SELECT to_jsonb(f) FROM public.facturas f WHERE f.id=fac),
      'payments',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)
        FROM public.pagos_factura p WHERE p.factura_id=fac),
      'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]'::jsonb)
        FROM public.factura_notas_credito n WHERE n.factura_id=fac)) INTO before_facts;
    SELECT x INTO STRICT check_row FROM jsonb_array_elements(public.validar_cierre_embarque(embarque)->'checks') x
    WHERE x->>'regla'='cxc_cobrada';
    SELECT x INTO STRICT money_row FROM jsonb_array_elements(check_row->'detalle'->'por_moneda') x
    WHERE x->>'moneda'=caso.moneda;
    PERFORM pg_temp.assert(COALESCE((check_row->>'ok')::boolean=caso.ok_esperado,false),
      'AUD54 closure check in '||caso.nombre||': '||check_row::text);
    PERFORM pg_temp.assert(COALESCE((money_row->>'saldo')::numeric=caso.saldo_esperado
      AND (money_row->>'facturas_pendientes')::int=caso.pendientes_esperados,false),
      'AUD54 native monetary balance/count in '||caso.nombre||': '||money_row::text);
    PERFORM pg_temp.assert(COALESCE((money_row->>'pagado')::numeric=CASE
      WHEN caso.monto_pago IS NULL THEN 0 WHEN caso.moneda=caso.moneda_pago THEN caso.monto_pago
      ELSE caso.monto_pago/20 END,false),
      'AUD54 excludes canceled/deleted cash without rewriting it: '||caso.nombre);
    PERFORM pg_temp.assert(COALESCE((money_row->>'notas_credito')::numeric=CASE
      WHEN caso.estado_nc IN ('Timbrada','Aplicada') THEN 20 ELSE 0 END,false),
      'AUD54 preserves NC lifecycle and native conversion: '||caso.nombre);
    IF caso.nombre='half-cent-USD-payment-MXN' THEN
      PERFORM pg_temp.assert(COALESCE(public.saldo_factura(fac)=0.005,false),
        'AUD54 classifies the exact native half-cent before MXN conversion');
    ELSIF caso.nombre='subcent-USD-payment-MXN' THEN
      PERFORM pg_temp.assert(COALESCE(public.saldo_factura(fac)=0.0045,false),
        'AUD54 preserves subcent exact balance although monetary closure is zero');
    END IF;
    IF caso.historica AND caso.monto_pago IS NULL THEN
      PERFORM pg_temp.assert(COALESCE((check_row->'detalle'->>'pagadas_sin_pago_registrado')::int=1,false),
        'AUD54 legacy is reported without inventing debt: '||caso.nombre);
    END IF;
    SELECT jsonb_build_object(
      'invoice',(SELECT to_jsonb(f) FROM public.facturas f WHERE f.id=fac),
      'payments',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb)
        FROM public.pagos_factura p WHERE p.factura_id=fac),
      'credits',(SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]'::jsonb)
        FROM public.factura_notas_credito n WHERE n.factura_id=fac)) INTO after_facts;
    PERFORM pg_temp.assert(after_facts IS NOT DISTINCT FROM before_facts,
      'AUD54 closure read preserves states, exact amounts, timestamps and document facts: '||caso.nombre);
    IF caso.nombre='historical-Pagada-cent' THEN
      err := NULL;
      BEGIN
        INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,tipo_cambio,forma_pago)
        VALUES(fac,fx.org_a,hoy,0.01,'MXN',1,'Transferencia');
      EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      END;
      PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_EXHIBICION_UNICA:%',false),
        'AUD54 closure visibility must not permit a second PUE payment');
      PERFORM pg_temp.assert(COALESCE(public.saldo_factura(fac)=0.01,false),
        'AUD54 second-PUE rejection preserves exact cent');
    END IF;
    -- Cross-organization calls fail before any closure detail can be disclosed.
    PERFORM pg_temp.as_user(fx.admin_b);
    err := NULL;
    BEGIN
      PERFORM public.validar_cierre_embarque(embarque);
    EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    END;
    PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_ORG_FORBIDDEN:%',false),
      'AUD54 closure preserves same-organization access: '||caso.nombre);
  END LOOP;

  -- Two native subcent residues must not combine into phantom monetary debt.
  -- A separate zero MXN invoice also cannot change the USD decision.
  PERFORM pg_temp.as_postgres();
  embarque := gen_random_uuid();
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
  VALUES(embarque,fx.org_a,cli,'ELAUD54001','Aéreo','Importación');
  FOR caso IN SELECT * FROM (VALUES('subcent-A','USD',23.11::numeric),
    ('subcent-B','USD',23.11),('zero-MXN','MXN',1.16)) AS c(nombre,moneda,monto_pago) LOOP
    PERFORM pg_temp.as_postgres();
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id,organization_id,cliente_id,cliente_nombre,embarque_id,numero,
      fecha_emision,fecha_vencimiento,moneda,tipo_cambio,subtotal,iva,total,estado,metodo_pago)
    VALUES(fac,fx.org_a,cli,'Fixture',embarque,'AUD54-CXC-SUM-'||caso.nombre,hoy,hoy+30,
      caso.moneda::public.moneda,CASE WHEN caso.moneda='USD' THEN 20 ELSE 1 END,
      1,0.16,1.16,'Emitida','PPD');
    PERFORM pg_temp.as_user(fx.admin_a);
    INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,tipo_cambio,forma_pago,estado_rep)
    VALUES(fac,fx.org_a,hoy,caso.monto_pago,'MXN',CASE WHEN caso.moneda='USD' THEN 20 ELSE 1 END,
      'Transferencia','NoAplica');
  END LOOP;
  SELECT x INTO STRICT check_row FROM jsonb_array_elements(public.validar_cierre_embarque(embarque)->'checks') x
  WHERE x->>'regla'='cxc_cobrada';
  PERFORM pg_temp.assert(COALESCE((check_row->>'ok')::boolean,false)
    AND jsonb_array_length(check_row->'detalle'->'por_moneda')=2
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(check_row->'detalle'->'por_moneda') x
      WHERE (x->>'saldo')::numeric<>0 OR (x->>'facturas_pendientes')::int<>0),
    'AUD54 native rounding is per invoice before monetary aggregation: '||check_row::text);

  PERFORM pg_temp.as_postgres();
  SELECT p.prosecdef,p.proconfig INTO STRICT metadata FROM pg_proc p
  WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure;
  PERFORM pg_temp.assert(COALESCE(metadata.prosecdef AND metadata.proconfig @> ARRAY['search_path=public'],false),
    'AUD54 closure retains SECURITY DEFINER and fixed search_path');
  PERFORM pg_temp.assert(has_function_privilege('authenticated','public.validar_cierre_embarque(uuid)','EXECUTE')
    AND has_function_privilege('service_role','public.validar_cierre_embarque(uuid)','EXECUTE')
    AND NOT has_function_privilege('anon','public.validar_cierre_embarque(uuid)','EXECUTE')
    AND NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
      aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE'),
    'AUD54 closure retains authenticated/service access without public or anonymous execution');
  RAISE NOTICE 'AUD54 closure CxC: monetary cent, zero, FX boundaries, legacy, active evidence, NC, organization and ACL passed';
END
$tests$;
ROLLBACK;
