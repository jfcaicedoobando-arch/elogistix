-- Local isolated PostgreSQL only. Real application RPCs; every fixture rolls back.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $test$
DECLARE
 o record; cli uuid:=gen_random_uuid(); prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
 e uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); fm uuid:=gen_random_uuid(); req uuid:=gen_random_uuid();
 a public.anticipos_proveedor; ap public.anticipos_aplicaciones; again public.anticipos_aplicaciones;
 d jsonb; s jsonb; check_cxp jsonb; eur numeric; aging_eur numeric; frozen numeric; today date:=public.fecha_negocio_mx();
BEGIN
 SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD134CANON');
 INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,o.org_a,'AUD134CANON','audit134-canon@test.local');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
 VALUES(prov,o.org_a,'AUD134CANON','GastoOperativo','Otros');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,o.org_a,'AUD134CANON');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd)
 VALUES(e,o.org_a,cli,'ELIMP13402','Aéreo','Importación',17.3370);
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,categoria_presupuesto_id,folio_proveedor,fecha_emision,fecha_vencimiento,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(f,o.org_a,prov,e,cat,'AUD134CANON-EUR',today-2,today-1,'EUR',18,200,200,'Vigente','aprobada'),
       (fm,o.org_a,prov,e,cat,'AUD134CANON-USD',today-2,today-1,'USD',17.3370,1,1,'Vigente','aprobada');
 INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,origen)
 VALUES(today,17.3370,20,'manual') ON CONFLICT(fecha) DO UPDATE SET usd_mxn=17.3370,eur_mxn=20;
 PERFORM pg_temp.as_user(o.admin_a);
 a:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>100,p_moneda=>'USD',p_tipo_cambio_usd=>17.1527,p_fecha_anticipo=>today-1,p_metodo_pago=>'Efectivo');
 ap:=public.aplicar_anticipo_a_factura(a.id,f,100,today,req);
 SELECT monto_en_moneda_factura INTO frozen FROM public.pagos_proveedor WHERE id=ap.pago_proveedor_id;
 PERFORM pg_temp.assert(frozen=86.6850,'AUD134CANON: real RPC must freeze 100 USD as 86.6850 EUR');
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 SELECT (x->>'saldo')::numeric INTO STRICT eur FROM jsonb_array_elements(d->'saldos') x WHERE x->>'moneda'='EUR';
 SELECT sum((x->>'saldo')::numeric) INTO aging_eur FROM jsonb_array_elements(d->'aging') x WHERE x->>'moneda'='EUR';
 s:=public.saldo_factura_proveedor(f);
 PERFORM pg_temp.assert(eur=113.3150 AND aging_eur=eur,'AUD134CANON: global and aging must use the same frozen EUR application');
 PERFORM pg_temp.assert((s->>'saldo')::numeric=round(eur,2) AND NOT (s->>'flujo_incompleto')::boolean,'AUD134CANON: canonical invoice must agree and not report false missing TC');
 SELECT x INTO STRICT check_cxp FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(check_cxp->'detalle'->'por_moneda') x WHERE x->>'moneda'='EUR' AND (x->>'saldo')::numeric=eur AND (x->>'pagado')::numeric=frozen AND (x->>'pagos_sin_tipo_cambio')::int=0),'AUD134CANON: closure must agree with frozen EUR payment');
 PERFORM pg_temp.assert((SELECT count(*) FROM jsonb_array_elements(d->'movimientos') x WHERE x->>'ref_id'=ap.pago_proveedor_id::text)=2,'AUD134CANON: application must have exactly two currency legs');
 again:=public.aplicar_anticipo_a_factura(a.id,f,100,today,req);
 PERFORM pg_temp.assert(again.id=ap.id,'AUD134CANON: retry must not create another application');
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE anticipo_proveedor_id=a.id),'AUD134CANON: no bank movement for reclassification');
 -- Re-reading after DOF changes must not revalue this recorded application.
 PERFORM pg_temp.as_postgres();
 UPDATE public.tipos_cambio_dof SET usd_mxn=25,eur_mxn=30 WHERE fecha=today;
 PERFORM pg_temp.as_user(o.admin_a);
 PERFORM pg_temp.assert(public.saldo_factura_proveedor(f)=s,'AUD134CANON: canonical amount remains frozen after DOF change');
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'saldos') x WHERE x->>'moneda'='EUR' AND (x->>'saldo')::numeric=eur),'AUD134CANON: statement remains frozen after DOF change');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'aging') x WHERE x->>'moneda'='EUR' AND (x->>'saldo')::numeric=eur),'AUD134CANON: aging remains frozen after DOF change');
 SELECT x INTO STRICT check_cxp FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(check_cxp->'detalle'->'por_moneda') x WHERE x->>'moneda'='EUR' AND (x->>'saldo')::numeric=eur AND (x->>'pagado')::numeric=frozen),'AUD134CANON: closure remains frozen after DOF change');
 -- Reverse through the real domain RPC; no constraint or trigger is relaxed.
 PERFORM public.eliminar_pago_proveedor(ap.pago_proveedor_id);
 s:=public.saldo_factura_proveedor(f);
 PERFORM pg_temp.assert((s->>'saldo')::numeric=200 AND NOT (s->>'flujo_incompleto')::boolean,'AUD134CANON: reversal restores invoice balance');
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'movimientos') x WHERE x->>'ref_id'=ap.pago_proveedor_id::text),'AUD134CANON: reversal removes both reclassification legs');
 a:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>1,p_moneda=>'MXN',p_fecha_anticipo=>today,p_metodo_pago=>'Efectivo');
 ap:=public.aplicar_anticipo_a_factura(a.id,fm,1,today,gen_random_uuid());
 s:=public.saldo_factura_proveedor(fm);
 PERFORM pg_temp.assert((s->>'pagado')::numeric=0.04 AND (s->>'saldo')::numeric=0.96,'AUD134CANON: new MXN/USD application uses its own current application rate');
 -- Ordinary direct payments keep the existing payment-rate conversion.
 INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,monto,moneda,tipo_cambio_usd,fecha_pago,metodo_pago)
 VALUES(o.org_a,fm,10,'MXN',20,today,'Efectivo');
 s:=public.saldo_factura_proveedor(fm);
 PERFORM pg_temp.assert((s->>'pagado')::numeric=0.54 AND (s->>'saldo')::numeric=0.46,'AUD134CANON: direct payment uses its recorded 20 rate, not application DOF 25');
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'saldos') x WHERE x->>'moneda'='USD' AND (x->>'saldo')::numeric+100=0.46),'AUD134CANON: statement reconciles invoice debt after separating the original unapplied 100 USD credit');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'aging') x WHERE x->>'moneda'='USD' AND (x->>'saldo')::numeric=0.46),'AUD134CANON: mixed direct payment and applied advance agree in aging');
 SELECT x INTO STRICT check_cxp FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x WHERE x->>'regla'='cxp_pagada';
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(check_cxp->'detalle'->'por_moneda') x WHERE x->>'moneda'='USD' AND (x->>'saldo')::numeric=0.46 AND (x->>'pagado')::numeric=0.54),'AUD134CANON: mixed direct payment and applied advance agree in closure');
 -- Live NULL frozen amounts are forbidden by the production constraint. The
 -- pure helper and caller-structure suite cover that historical shape instead.
 PERFORM pg_temp.as_user(o.admin_b);
 PERFORM pg_temp.assert(public.saldo_factura_proveedor(f) IS NULL,'AUD134CANON: canonical balance tenant guard changed');
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(jsonb_array_length(d->'movimientos')=0,'AUD134CANON: statement tenant guard changed');
 RAISE NOTICE 'audit134 canon: real USD/EUR RPC, global/aging/canonical/closure consistency, DOF stability, retry, reversal, direct-payment compatibility and isolation passed';
END $test$;
ROLLBACK;
