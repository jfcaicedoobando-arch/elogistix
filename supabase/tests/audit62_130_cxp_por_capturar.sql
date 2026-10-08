-- Disposable fixtures only. No fiscal stamping, remote data or history repair.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE OR REPLACE FUNCTION pg_temp.assert_captura(
  _e uuid, _mxn numeric, _usd numeric, _n integer, _fecha date,
  _presupuesto numeric DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  SELECT * INTO STRICT r FROM public.cxp_por_capturar() WHERE embarque_id=_e;
  PERFORM pg_temp.assert(abs(r.facturado_mxn-_mxn)<0.000000001
    AND abs(r.facturado_usd-_usd)<0.000000001 AND r.facturas_capturadas=_n
    AND r.ultima_factura_fecha IS NOT DISTINCT FROM _fecha
    AND r.dias_desde_ultima_factura IS NOT DISTINCT FROM (CURRENT_DATE-_fecha),
    'Capture amount/count/date: ' || row_to_json(r)::text);
  IF _presupuesto IS NOT NULL THEN
    PERFORM pg_temp.assert(r.presupuestado_mxn=_presupuesto,
      'Budget must remain unchanged: ' || row_to_json(r)::text);
  END IF;
END $$;
DO $tests$
DECLARE
  fx record; prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid(); cli uuid:=gen_random_uuid();
  e4 uuid:=gen_random_uuid(); e16 uuid:=gen_random_uuid(); e17 uuid:=gen_random_uuid();
  eh uuid:=gen_random_uuid(); ep uuid:=gen_random_uuid(); eq uuid:=gen_random_uuid();
  c4 uuid:=gen_random_uuid(); c16 uuid:=gen_random_uuid(); c40 uuid:=gen_random_uuid(); c17 uuid:=gen_random_uuid();
  ca uuid:=gen_random_uuid(); cp uuid:=gen_random_uuid(); cq uuid:=gen_random_uuid(); ch uuid:=gen_random_uuid();
  pf13 uuid:=gen_random_uuid(); pf21 uuid:=gen_random_uuid(); pf23 uuid:=gen_random_uuid();
  pfusd uuid:=gen_random_uuid(); pfp uuid:=gen_random_uuid(); pfx uuid:=gen_random_uuid();
  nc uuid:=gen_random_uuid(); snapshot jsonb; r record;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD62_130');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
    VALUES(prov,fx.org_a,'AUD62 supplier','Logistico','Naviera');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'AUD62 cost');
  INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,fx.org_a,'AUD62 client','audit62@test.local');
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(e4,fx.org_a,cli,'DEMO-2026-620004','Marítimo','Importación'),
      (e16,fx.org_a,cli,'DEMO-2026-620016','Terrestre','Nacional'),
      (e17,fx.org_a,cli,'DEMO-2026-620017','Terrestre','Nacional'),
      (eh,fx.org_a,cli,'DEMO-2026-620018','Terrestre','Nacional'),
      (ep,fx.org_a,cli,'DEMO-2026-620019','Terrestre','Nacional'),
      (eq,fx.org_a,cli,'DEMO-2026-620020','Terrestre','Nacional');
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,origen)
    VALUES(c4,fx.org_a,e4,prov,'FP13 budget',1000,'MXN','manual'),
      (c16,fx.org_a,e16,prov,'Original 100',100,'MXN','manual'),
      (ca,fx.org_a,e16,prov,'Historical -40 adjustment',-40,'MXN','ajuste_factura_proveedor'),
      (c40,fx.org_a,e16,prov,'Additional 40',40,'MXN','manual'),
      (c17,fx.org_a,e17,prov,'Budget120.44',120.44,'MXN','manual'),
      (ch,fx.org_a,eh,prov,'Header budget',100,'MXN','manual'),
      (cp,fx.org_a,ep,prov,'Quantity budget',100,'MXN','manual'),
      (cq,fx.org_a,eq,prov,'Quantity budget2',100,'MXN','manual');
  PERFORM pg_temp.as_user(fx.admin_a);
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado,fecha_emision)
    VALUES(pf13,fx.org_a,prov,cat,e4,'AUD62-FP13','MXN',1000,160,1160,'Vigente',CURRENT_DATE-10),
      (pf21,fx.org_a,prov,cat,e16,'AUD62-FP21','MXN',60,0,60,'Vigente',CURRENT_DATE-9),
      (pf23,fx.org_a,prov,cat,NULL,'AUD130-FP23','MXN',140,0,140,'Vigente',CURRENT_DATE-3);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pf13,NULL,'Fiscal1000',1,1000),
      (fx.org_a,pf21,NULL,'Fiscal60',1,60),
      (fx.org_a,pf21,c16,'Assigned60',1,60),
      (fx.org_a,pf21,ca,'Adjustment bridge',1,-40),
      (fx.org_a,pf23,NULL,'Fiscal2x70',2,70),
      (fx.org_a,pf23,c40,'Assigned40',1,40),
      (fx.org_a,pf23,c17,'Assigned100',1,100);
  -- The three separately verified GUI regressions. The -40 budget is untouched.
  PERFORM pg_temp.assert_captura(e4,1000,0,1,CURRENT_DATE-10,1000);
  PERFORM pg_temp.assert_captura(e17,100,0,1,CURRENT_DATE-3,120.44);
  PERFORM pg_temp.assert_captura(e16,100,0,2,CURRENT_DATE-3,100);
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO snapshot
    FROM public.proveedor_facturas_conceptos a WHERE a.proveedor_factura_id IN(pf13,pf21,pf23);
  -- Header origin never adds a second attribution; same date/count set.
  UPDATE public.proveedor_facturas SET embarque_id=eh WHERE id=pf23;
  PERFORM pg_temp.assert_captura(eh,0,0,0,NULL,100);
  PERFORM pg_temp.assert_captura(e16,100,0,2,CURRENT_DATE-3,100);
  UPDATE public.proveedor_facturas SET embarque_id=e16 WHERE id=pf23;
  PERFORM pg_temp.assert_captura(e16,100,0,2,CURRENT_DATE-3,100);
  -- Credit notes affect debt/profit, never whether an invoice was captured.
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
    VALUES(nc,fx.org_a,pf13,CURRENT_DATE,116,100,'MXN','Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
  PERFORM pg_temp.assert_captura(e4,1000,0,1,CURRENT_DATE-10,1000);
  -- Cross-currency links remain in documentary currency; changing FX has no effect.
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,tipo_cambio_usd,estado,fecha_emision)
    VALUES(pfusd,fx.org_a,prov,cat,NULL,'AUD62-USD','USD',10,1.6,11.6,20,'Borrador',CURRENT_DATE-1);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pfusd,ch,'USD link to MXN budget',1,10);
  PERFORM pg_temp.assert_captura(eh,0,10,1,CURRENT_DATE-1,100);
  UPDATE public.proveedor_facturas SET tipo_cambio_usd=21 WHERE id=pfusd;
  PERFORM pg_temp.assert_captura(eh,0,10,1,CURRENT_DATE-1,100);
  -- Draft is a captured document; cancellation removes amounts AND date/count.
  PERFORM public.cancelar_factura_proveedor(pfusd,'Rolled-back capture regression');
  INSERT INTO public.proveedor_facturas(organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(fx.org_a,prov,cat,eh,'AUD62-CANCELLED-HEADER','MXN',50,8,58,'Cancelada');
  PERFORM pg_temp.assert_captura(eh,0,0,0,NULL,100);
  UPDATE public.proveedor_facturas SET deleted_at=now() WHERE id=pf23;
  PERFORM pg_temp.assert_captura(e17,0,0,0,NULL,120.44);
  PERFORM pg_temp.assert_captura(e16,60,0,1,CURRENT_DATE-9,100);
  PERFORM public.restore_record('proveedor_facturas',pf23);
  -- Cost deletion removes only that link; residue is not assigned to the header.
  UPDATE public.conceptos_costo SET deleted_at=now() WHERE id=c40;
  PERFORM pg_temp.assert_captura(e16,60,0,1,CURRENT_DATE-9,60);
  PERFORM pg_temp.assert_captura(e17,100,0,1,CURRENT_DATE-3,120.44);
  PERFORM public.restore_record('conceptos_costo',c40);
  -- Multiple links on one shipment still count one invoice. Quantity once,
  -- partial amount exact, then proportional cap after a fiscal reduction.
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pfp,fx.org_a,prov,cat,eh,'AUD62-PRECISION','MXN',100,0,100,'Vigente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pfp,cp,'Fractional quantity',2.5,10),
      (fx.org_a,pfp,cp,'Another link same shipment',1,0.005),
      (fx.org_a,pfp,cq,'Second shipment',1,25.005);
  PERFORM pg_temp.assert_captura(ep,25.005,0,1,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eq,25.005,0,1,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eh,0,0,0,NULL,100);
  UPDATE public.proveedor_facturas SET subtotal=30.01,total=30.01 WHERE id=pfp;
  PERFORM pg_temp.assert_captura(ep,15.005,0,1,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eq,15.005,0,1,CURRENT_DATE,100);
  UPDATE public.proveedor_facturas SET subtotal=0,total=0 WHERE id=pfp;
  PERFORM pg_temp.assert_captura(ep,0,0,1,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eq,0,0,1,CURRENT_DATE,100);
  -- Nonpositive quantities/amounts and adjustment bridges do not suppress
  -- the legacy header fallback. A zero quantity keeps the existing legacy1.
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pfx,fx.org_a,prov,cat,eh,'AUD62-EFFECTIVE','MXN',12.34,0,12.34,'Borrador');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pfx,cp,'Negative quantity',-1,10),
      (fx.org_a,pfx,cq,'Zero amount',1,0),
      (fx.org_a,pfx,ca,'Positive adjustment bridge',1,10),
      (fx.org_a,pfx,cp,'Two negatives do not make membership',-1,-10);
  PERFORM pg_temp.assert_captura(eh,12.34,0,1,CURRENT_DATE,100);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pfx,cp,'Zero quantity legacy1',0,10);
  PERFORM pg_temp.assert_captura(ep,10,0,2,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eh,0,0,0,NULL,100);
  -- Inject an invalid legacy organization only inside this rolled-back fixture.
  -- The read must remain tenant-consistent even for a role that bypasses RLS.
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('session_replication_role','replica',true);
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_b,pfx,cq,'Wrong-tenant historical link',1,1000);
  PERFORM set_config('session_replication_role','origin',true);
  PERFORM pg_temp.assert_captura(ep,10,0,2,CURRENT_DATE,100);
  PERFORM pg_temp.assert_captura(eq,0,0,1,CURRENT_DATE,100);
  PERFORM pg_temp.as_user(fx.admin_a);
  -- Read-only reports did not mutate any original fiscal/allocation bytes.
  PERFORM pg_temp.assert(snapshot=(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
    FROM public.proveedor_facturas_conceptos a WHERE a.proveedor_factura_id IN(pf13,pf21,pf23)),
    'Reporting must not rewrite the original assignments');
  -- Row eligibility also keeps currencies separate: a negative historical
  -- MXN budget must not cancel a positive USD budget nominally.
  INSERT INTO public.conceptos_costo(organization_id,embarque_id,proveedor_id,concepto,monto,moneda,origen)
    VALUES(fx.org_a,eh,prov,'USD budget',10,'USD','manual'),
      (fx.org_a,eh,prov,'Historical MXN adjustment',-1200,'MXN','ajuste_factura_proveedor');
  PERFORM pg_temp.assert_captura(eh,0,0,0,NULL,-1100);
  PERFORM pg_temp.assert((SELECT presupuestado_usd=10 FROM public.cxp_por_capturar()
    WHERE embarque_id=eh), 'A separate positive USD budget must remain visible');
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.cxp_por_capturar()
    WHERE embarque_id IN(e4,e16,e17,eh,ep,eq)), 'Other tenant must not see captures');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.cxp_por_capturar()'::regprocedure),
    'Capture RPC must remain SECURITY INVOKER');
  PERFORM pg_temp.assert(has_function_privilege('authenticated','public.cxp_por_capturar()','EXECUTE')
    AND has_function_privilege('service_role','public.cxp_por_capturar()','EXECUTE'), 'Existing authenticated/service RPC grants');
  BEGIN
    PERFORM set_config('role','anon',true);
    PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.cxp_por_capturar()),
      'Anonymous invoker must not read tenant rows');
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Existing table privileges may deny before RLS yields an empty set.
  END;
  PERFORM pg_temp.as_postgres();
END $tests$;
ROLLBACK;
