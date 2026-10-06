-- Read-only reporting regressions on disposable PostgreSQL. All fixtures roll back.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.assert_pnl_cuadra(p jsonb, esperado numeric, deuda numeric)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE detalle numeric; proveedores numeric;
BEGIN
  SELECT coalesce(sum((x->>'real_mxn')::numeric),0) INTO detalle
    FROM jsonb_array_elements(p->'por_concepto_costo') x;
  SELECT coalesce(sum((x->>'real_mxn')::numeric),0) INTO proveedores
    FROM jsonb_array_elements(p->'por_proveedor') x;
  PERFORM pg_temp.assert(abs((p->'costo'->>'real_mxn')::numeric - esperado) < 0.00001,
    'KPI cost: expected ' || esperado || ', got ' || p::text);
  PERFORM pg_temp.assert(abs(detalle - esperado) < 0.00001, 'Detail must reconcile exactly once: ' || p::text);
  PERFORM pg_temp.assert(abs(proveedores - esperado) < 0.00001, 'Supplier total must reconcile: ' || p::text);
  PERFORM pg_temp.assert(abs((p->'costo'->>'pdte_pago_mxn')::numeric - deuda) < 0.00001,
    'Allocated debt: expected ' || deuda || ', got ' || p::text);
END $$;

DO $tests$
DECLARE
  fx record;
  prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); cli uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid(); c40 uuid := gen_random_uuid(); c100 uuid := gen_random_uuid();
  ajuste uuid := gen_random_uuid(); pf1 uuid := gen_random_uuid(); pf2 uuid := gen_random_uuid();
  pf3 uuid := gen_random_uuid(); nc uuid := gen_random_uuid(); p jsonb;
  e4 uuid := gen_random_uuid(); pf4 uuid := gen_random_uuid(); nc2 uuid := gen_random_uuid(); nc3 uuid := gen_random_uuid();
  e5 uuid := gen_random_uuid(); e6 uuid := gen_random_uuid(); pf5 uuid := gen_random_uuid();
  c60a uuid := gen_random_uuid(); c60b uuid := gen_random_uuid(); nc4 uuid := gen_random_uuid();
  asignaciones_antes jsonb;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD124_130');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
    VALUES(prov,fx.org_a,'AUD124 supplier','Logistico','Naviera');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'AUD124 direct cost');
  INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,fx.org_a,'AUD124 client','audit124@test.local');
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(e1,fx.org_a,cli,'DEMO-2026-124001','Marítimo','Importación'),
          (e2,fx.org_a,cli,'DEMO-2026-124002','Marítimo','Importación'),
          (e3,fx.org_a,cli,'DEMO-2026-124003','Marítimo','Importación'),
          (e4,fx.org_a,cli,'DEMO-2026-124004','Marítimo','Importación');
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,origen)
    VALUES(c1,fx.org_a,e1,prov,'Original budget',100,'MXN','manual'),
          (ajuste,fx.org_a,e1,prov,'Historical budget adjustment',-40,'MXN','ajuste_factura_proveedor');
  PERFORM pg_temp.as_user(fx.admin_a);
  p := public.pnl_financiero_embarque(e2);
  PERFORM pg_temp.assert(p->>'estado_costos' = 'incompleto' AND p->'utilidad_mxn' = 'null'::jsonb,
    '129: no supplier invoice must preserve indeterminate profit');

  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pf1,fx.org_a,prov,cat,e1,'AUD124-PARTIAL','MXN',60,0,60,'Vigente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pf1,NULL,'Fiscal partial',1,60),
          (fx.org_a,pf1,c1,'Allocated partial',1,60),
          (fx.org_a,pf1,ajuste,'Budget adjustment bridge',1,-40);
  p := public.pnl_financiero_embarque(e1);
  PERFORM pg_temp.assert_pnl_cuadra(p,60,60);
  PERFORM pg_temp.assert((p->'costo'->>'presupuestado_mxn')::numeric = 60,
    '124: historical budget adjustment remains budget only');

  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
    VALUES(c40,fx.org_a,e1,prov,'Allocation 40',40,'MXN'),
          (c100,fx.org_a,e2,prov,'Allocation 100',100,'MXN');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pf2,fx.org_a,prov,cat,'AUD130-MULTI','MXN',140,0,140,'Vigente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pf2,NULL,'Fiscal 2 x 70',2,70),
          (fx.org_a,pf2,c40,'Assigned40',1,40),
          (fx.org_a,pf2,c100,'Assigned100',1,100);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e1),100,100);
  p := public.pnl_financiero_embarque(e2);
  PERFORM pg_temp.assert_pnl_cuadra(p,100,100);
  PERFORM pg_temp.assert(p->>'estado_costos' = 'completo', '130: allocations complete cost membership without header');
  -- An inbox/header origin must not reassign or duplicate an allocated invoice.
  UPDATE public.proveedor_facturas SET embarque_id=e1 WHERE id=pf2;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e1),100,100);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e2),100,100);

  PERFORM pg_temp.assert((SELECT sum((x->>'facturas_count')::int)
    FROM jsonb_array_elements(public.pnl_financiero_embarque(e1)->'por_proveedor') x) = 2,
    '130: count a multi-shipment invoice once per participating shipment');
  UPDATE public.proveedor_facturas SET iva=22.4,total=162.4 WHERE id=pf2;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e1),100,106.4);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e2),100,116);

  -- Under-allocation must not scale40/60 to56/84, with any header origin.
  UPDATE public.proveedor_facturas_conceptos SET monto=60
    WHERE proveedor_factura_id=pf2 AND concepto_costo_id=c100;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e1),100,106.4);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e2),60,69.6);
  p := public.pnl_financiero_embarque(e1);
  PERFORM pg_temp.assert((p->>'costo_sin_asignar_mxn')::numeric=40
    AND p->>'estado_costos'='incompleto' AND p->'utilidad_mxn'='null'::jsonb,
    'Partial linked invoice keeps its40 residue unassigned and profit provisional');
  UPDATE public.proveedor_facturas SET embarque_id=NULL WHERE id=pf2;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e1),100,106.4);
  UPDATE public.proveedor_facturas SET embarque_id=e3 WHERE id=pf2;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e3),0,0);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e2),60,69.6);

  -- Header fallback with quantities >1 and tax, then explicit net credit.
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pf3,fx.org_a,prov,cat,e3,'AUD124-HEADER','MXN',100,16,116,'Vigente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,descripcion,cantidad,monto,iva)
    VALUES(fx.org_a,pf3,'Fiscal 4 x 25',4,25,16);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e3),100,116);
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
    VALUES(nc,fx.org_a,pf3,CURRENT_DATE,29,25,'MXN','Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e3),75,87);
  -- Same invoice without fiscal lines must have one fallback with the same net base.
  DELETE FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id=pf3;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e3),75,87);
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    embarque_id,folio_proveedor,moneda,subtotal,iva,total,tipo_cambio_usd,estado)
    VALUES(pf4,fx.org_a,prov,cat,e4,'AUD125-PNL-EUR','EUR',100,0,100,20,'Vigente');
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio_mxn,estado)
    VALUES(nc2,fx.org_a,pf4,CURRENT_DATE,50,50,'EUR',22,'Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc2;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc2;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e4),900,1000);
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,tipo_cambio,tipo_cambio_mxn,estado)
    VALUES(nc3,fx.org_a,pf4,CURRENT_DATE,220,220,'MXN',22,1,'Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc3;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc3;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e4),680,800);

  -- A legitimate fiscal edit can leave preserved links larger than the new
  -- invoice. Cap only the read-only report, never mutate or expand assignments.
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(e5,fx.org_a,cli,'DEMO-2026-124005','Marítimo','Importación'),
          (e6,fx.org_a,cli,'DEMO-2026-124006','Marítimo','Importación');
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
    VALUES(c60a,fx.org_a,e5,prov,'Preserved allocation A',60,'MXN'),
          (c60b,fx.org_a,e6,prov,'Preserved allocation B',60,'MXN');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
    folio_proveedor,moneda,subtotal,iva,total,estado)
    VALUES(pf5,fx.org_a,prov,cat,'AUD130-FISCAL-EDIT','MXN',120,0,120,'Vigente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,pf5,NULL,'Original fiscal base',1,120),
          (fx.org_a,pf5,c60a,'Preserved allocation A',1,60),
          (fx.org_a,pf5,c60b,'Preserved allocation B',1,60);
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO asignaciones_antes
    FROM public.proveedor_facturas_conceptos a
    WHERE a.proveedor_factura_id=pf5 AND a.concepto_costo_id IS NOT NULL;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e5),60,60);
  PERFORM public.reemplazar_conceptos_factura_proveedor(pf5,
    '[{"descripcion":"Corrected fiscal base","cantidad":1,"monto":100}]'::jsonb,
    NULL, (SELECT updated_at FROM public.proveedor_facturas WHERE id=pf5));
  PERFORM pg_temp.assert((SELECT subtotal=100 AND total=100 FROM public.proveedor_facturas WHERE id=pf5),
    '130: legitimate edit reduces the fiscal invoice to100');
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e5),50,50);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e6),50,50);
  p := public.pnl_financiero_embarque(e5);
  PERFORM pg_temp.assert(p->>'estado_costos'='incompleto' AND p->'utilidad_mxn'='null'::jsonb
    AND (p->>'facturas_sobreasignadas')::int=1 AND (p->>'costo_sobreasignado_mxn')::numeric=20,
    '130: overallocated invoice exposes excess20 and provisional profit after proportional cap');
  PERFORM pg_temp.assert((p->>'costo_sin_asignar_mxn')::numeric=0,
    '130: an excess must not also create unassigned cost');
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
    VALUES(nc4,fx.org_a,pf5,CURRENT_DATE,20,20,'MXN','Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=nc4;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=nc4;
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e5),40,40);
  PERFORM pg_temp.assert_pnl_cuadra(public.pnl_financiero_embarque(e6),40,40);
  PERFORM pg_temp.assert((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
    FROM public.proveedor_facturas_conceptos a
    WHERE a.proveedor_factura_id=pf5 AND a.concepto_costo_id IS NOT NULL) = asignaciones_antes,
    '130: fiscal edit, provisional P&L and credit leave all allocation bytes unchanged');

  -- Represent a pre-migration NC only in this rolled-back synthetic fixture.
  -- Bypass capture guards for the legacy null-base shape, never repair history.
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('session_replication_role','replica',true);
  UPDATE public.proveedor_notas_credito SET subtotal=NULL WHERE id=nc;
  PERFORM set_config('session_replication_role','origin',true);
  PERFORM pg_temp.as_user(fx.admin_a);
  p := public.pnl_financiero_embarque(e3);
  PERFORM pg_temp.assert_pnl_cuadra(p,100,87);
  PERFORM pg_temp.assert((p->>'notas_credito_sin_base')::int=1
    AND p->>'estado_costos'='incompleto' AND p->'utilidad_mxn'='null'::jsonb,
    'Legacy credit offsets debt but never invents expense base or definitive profit');
END $tests$;
ROLLBACK;
