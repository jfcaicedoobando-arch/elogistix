-- Real RPCs in an isolated local database. No fabricated bank movement.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $test$
DECLARE
 o record; prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); fm uuid:=gen_random_uuid();
 a public.anticipos_proveedor; ap public.anticipos_aplicaciones;
 d jsonb; usd numeric; mxn numeric; v_hoy date:=public.fecha_negocio_mx();
BEGIN
 SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('AUD134');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
 VALUES(prov,o.org_a,'AUD134','GastoOperativo','Otros');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,o.org_a,'AUD134');
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,fecha_emision,fecha_vencimiento,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(f,o.org_a,prov,cat,'AUD134USD',v_hoy-2,v_hoy-1,'USD',18.1903,1,1,'Vigente','aprobada'),
       (fm,o.org_a,prov,cat,'AUD134MXN',v_hoy-2,v_hoy-1,'MXN',1,1,1,'Vigente','aprobada');
 INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn,origen)
 VALUES(v_hoy,18.1903,20.44,'manual') ON CONFLICT(fecha) DO UPDATE SET usd_mxn=18.1903,eur_mxn=20.44;
 PERFORM pg_temp.as_user(o.admin_a);
 a:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>2,p_moneda=>'MXN',p_fecha_anticipo=>v_hoy-1,p_metodo_pago=>'Efectivo');
 ap:=public.aplicar_anticipo_a_factura(a.id,f,1,v_hoy,gen_random_uuid());
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 SELECT (s->>'saldo')::numeric INTO STRICT usd FROM jsonb_array_elements(d->'saldos') s WHERE s->>'moneda'='USD';
 SELECT (s->>'saldo')::numeric INTO STRICT mxn FROM jsonb_array_elements(d->'saldos') s WHERE s->>'moneda'='MXN';
 PERFORM pg_temp.assert(usd=0.945 AND mxn=0,'AUD134: cross must reduce USD debt and consume MXN credit');
 PERFORM pg_temp.assert(round(usd,2)=(public.saldo_factura_proveedor(f)->>'saldo')::numeric,'AUD134: canonical invoice and global statement differ: ' || usd::text || ' vs ' || public.saldo_factura_proveedor(f)::text);
 PERFORM pg_temp.assert((SELECT count(*) FROM jsonb_array_elements(d->'movimientos') m WHERE m->>'ref_id'=ap.pago_proveedor_id::text)=2,'AUD134: cross needs both currency legs');
 d:=public.proveedor_estado_cuenta_movimientos(prov,v_hoy,v_hoy);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'saldo_apertura') s WHERE s->>'moneda'='MXN' AND (s->>'saldo')::numeric=-1),'AUD134: opening must preserve original credit before application');
 -- Reverse the application through the authorized domain RPC.
 PERFORM public.eliminar_pago_proveedor(ap.pago_proveedor_id);
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'saldos') s WHERE s->>'moneda'='USD' AND (s->>'saldo')::numeric=1),'AUD134: reversal must restore USD debt');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'saldos') s WHERE s->>'moneda'='MXN' AND (s->>'saldo')::numeric=-1),'AUD134: reversal must restore MXN credit');
 -- Same-currency application remains 0/0 and does not double-count funds.
 ap:=public.aplicar_anticipo_a_factura(a.id,fm,1,v_hoy,gen_random_uuid());
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'movimientos') m WHERE m->>'ref_id'=ap.pago_proveedor_id::text AND (m->>'cargo')::numeric=0 AND (m->>'abono')::numeric=0),'AUD134: same-currency application must remain informative');
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE anticipo_proveedor_id=a.id),'AUD134: reclassification must not generate bank movement');
 PERFORM pg_temp.assert((SELECT estado='Pagada' FROM public.proveedor_facturas WHERE id=fm),'AUD134: known same-currency application settles the invoice');
 PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'aging') x WHERE x->>'moneda'='MXN'),'AUD134: known settled application preserves the Pagada aging shortcut');
 -- Cross in reverse direction, consuming a whole USD advance against MXN.
 PERFORM public.eliminar_pago_proveedor(ap.pago_proveedor_id);
 a:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>0.05,p_moneda=>'USD',p_tipo_cambio_usd=>18.1903,p_fecha_anticipo=>v_hoy,p_metodo_pago=>'Efectivo');
 ap:=public.aplicar_anticipo_a_factura(a.id,fm,0.05,v_hoy,gen_random_uuid());
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'movimientos') m WHERE m->>'ref_id'=ap.pago_proveedor_id::text AND m->>'moneda'='USD' AND (m->>'cargo')::numeric=0.05),'AUD134: inverse cross must consume original USD credit');
 PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM jsonb_array_elements(d->'movimientos') m WHERE m->>'ref_id'=ap.pago_proveedor_id::text AND m->>'moneda'='MXN' AND (m->>'abono')::numeric=0.9095),'AUD134: inverse cross must use canonical four-decimal conversion');
 PERFORM pg_temp.assert((SELECT saldo_disponible=0 FROM public.anticipos_proveedor WHERE id=a.id),'AUD134: whole advance must be consumed');
 PERFORM pg_temp.as_user(o.admin_b);
 d:=public.proveedor_estado_cuenta_movimientos(prov);
 PERFORM pg_temp.assert(jsonb_array_length(d->'movimientos')=0,'AUD134: tenant isolation changed');
 RAISE NOTICE 'audit134: per-currency balances, partial cross, opening, reversal, same currency and tenant isolation passed';
END $test$;
ROLLBACK;
