-- AUD141: complementary monetary counters, tenant/legacy boundaries. Fixtures roll back.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
 o record; cli uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); ef uuid;
 f uuid; leg uuid:=gen_random_uuid(); before_read jsonb;
 hoy date:=public.fecha_negocio_mx(); d integer; x record;
BEGIN
 SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD54_CONSUMERS');
 INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,origen) VALUES(hoy-2,20,'manual'),(hoy,20,'manual')
 ON CONFLICT(fecha) DO UPDATE SET usd_mxn=20;
 INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,o.org_a,'AUD54 Consumers','audit54consumers@example.invalid');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
 VALUES(e,o.org_a,cli,'DEMO-2026-5401','Aéreo','Importación');
 FOREACH d IN ARRAY ARRAY[-1,0,1] LOOP
   f:=gen_random_uuid();
   INSERT INTO public.facturas(id,organization_id,cliente_id,embarque_id,numero,subtotal,iva,total,moneda,tipo_cambio,estado,metodo_pago,fecha_emision,fecha_vencimiento)
   VALUES(f,o.org_a,cli,e,'AUD54-CENT-'||d,1,.16,1.16,'MXN',1,'Emitida','PPD',hoy-2,hoy+d);
   INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,tipo_cambio,forma_pago)
   VALUES(f,o.org_a,hoy,1.15,'MXN',1,'Efectivo');
   -- Reproduce only in this disposable fixture the old paid-state outcome.
   PERFORM set_config('app.recalc_estado_factura','1',true);
   UPDATE public.facturas SET estado='Pagada',metodo_pago='PUE' WHERE id=f;
   PERFORM set_config('app.recalc_estado_factura','',true);
 END LOOP;
 INSERT INTO public.facturas(id,organization_id,cliente_id,embarque_id,numero,subtotal,iva,total,moneda,tipo_cambio,estado,fecha_emision,fecha_vencimiento)
 VALUES(leg,o.org_a,cli,e,'AUD54-LEGACY',1,.16,1.16,'MXN',1,'Pagada',hoy-2,hoy-1),
   (gen_random_uuid(),o.org_a,cli,e,'AUD54-CANCELLED',1,.16,1.16,'MXN',1,'Cancelada',hoy-2,hoy-1);
 INSERT INTO public.facturas(id,organization_id,cliente_id,embarque_id,numero,subtotal,iva,total,moneda,tipo_cambio,estado,fecha_emision,fecha_vencimiento)
 VALUES(gen_random_uuid(),o.org_a,cli,e,'AUD141-USD-CENT',.01,0,.01,'USD',20,'Emitida',hoy-2,hoy);
 SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) INTO before_read FROM public.facturas q WHERE q.embarque_id=e;
 PERFORM pg_temp.as_user(o.admin_a);
 PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(o.org_a)=1,'AUD54: only yesterday is overdue');
 PERFORM pg_temp.assert(public.cobranza_conteo_por_cobrar(o.org_a)=3,'AUD141: today, tomorrow and native USD cent are to collect, without overlap');
 PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(o.org_a)+public.cobranza_conteo_por_cobrar(o.org_a)=public.cartera_pendiente_total(),
   'AUD54: complementary counters cover portfolio with real cents and no duplicate');
 PERFORM pg_temp.assert((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM public.facturas q WHERE q.embarque_id=e)=before_read,
   'AUD54: collection reads preserve all stored invoice facts');

 FOR x IN SELECT * FROM (VALUES
   (6.60::numeric,5.7138::numeric,.0049::numeric,true),
   (23.10::numeric,20::numeric,.005::numeric,false),
   (23::numeric,20::numeric,.01::numeric,false)) z(monto,tc,saldo,ok) LOOP
   PERFORM pg_temp.as_postgres();
   ef:=gen_random_uuid(); f:=gen_random_uuid();
   INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
   VALUES(ef,o.org_a,cli,'DEMO-2026-54'||(x.saldo*10000)::integer,'Aéreo','Importación');
   INSERT INTO public.facturas(id,organization_id,cliente_id,embarque_id,numero,subtotal,iva,total,moneda,tipo_cambio,estado,metodo_pago,fecha_emision,fecha_vencimiento)
   VALUES(f,o.org_a,cli,ef,'AUD54-FX-'||x.saldo,1,.16,1.16,'USD',20,'Emitida','PPD',hoy-2,hoy-1);
   INSERT INTO public.pagos_factura(factura_id,organization_id,fecha_pago,monto,moneda,tipo_cambio,forma_pago)
   VALUES(f,o.org_a,hoy,x.monto,'MXN',x.tc,'Efectivo');
   PERFORM pg_temp.as_user(o.admin_a);
   PERFORM pg_temp.assert(public.saldo_factura(f)=x.saldo,'AUD54: preserve exact four-decimal applied balance');
   PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.cobranza_listado() q WHERE q.id=f)=NOT x.ok,
     'AUD141: only positive native monetary debt belongs to collection; exact raw balance preserved');
 END LOOP;
 PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(o.org_a)=(SELECT count(*) FROM public.cobranza_listado(p_estatus=>'Vencida')),
   'AUD54: final complete overdue counter matches canonical list');
 PERFORM pg_temp.assert(public.cobranza_conteo_por_cobrar(o.org_a)=(SELECT count(*) FROM public.cobranza_listado() q
   WHERE ROUND(q.saldo,2)>0 AND q.estatus_cobranza<>'Vencida'),
   'AUD141: to-collect counter matches native positive monetary rows, including USD invoices');
 PERFORM pg_temp.as_user(o.admin_b);
 PERFORM pg_temp.assert(public.cobranza_conteo_vencidas(o.org_a)=0 AND public.cobranza_conteo_por_cobrar(o.org_a)=0,
   'AUD54: both complementary counters preserve explicit tenant scope');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.assert(NOT has_function_privilege('anon','public.cobranza_conteo_por_cobrar(uuid)','EXECUTE'),
   'AUD54: new complementary counter denies anon');
END $tests$;
ROLLBACK;
