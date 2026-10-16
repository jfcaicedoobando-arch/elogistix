-- Existing transaction A only. No INSERT/UPDATE/DELETE on the probe edge.
CREATE TEMP TABLE race_insert_parents(organization uuid,advance uuid,invoice uuid,payment uuid);
DO $parents$
DECLARE
 o uuid; p uuid; a uuid:=gen_random_uuid(); i uuid:=gen_random_uuid();
 pay uuid:=gen_random_uuid(); category uuid:=gen_random_uuid();
BEGIN
 SELECT org,provider INTO STRICT o,p FROM pg_temp.demo_test_ids
 WHERE org<>'de100000-0000-0000-0000-000000000001';
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre,tipo_contable)
 VALUES(category,o,'Synthetic race category','Administracion');
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,proveedor_nombre,
 categoria_presupuesto_id,folio_proveedor,fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(i,o,p,'Synthetic provider',category,'RACE-'||i,public.fecha_negocio_mx(),'MXN',1,100,100,'Vigente','aprobada');
 INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,tipo_cambio_usd,monto_en_moneda_factura)
 VALUES(pay,o,i,public.fecha_negocio_mx(),10,'MXN',1,10);
 INSERT INTO public.anticipos_proveedor(id,organization_id,proveedor_id,monto,moneda,saldo_disponible)
 VALUES(a,o,p,100,'MXN',100);
 INSERT INTO pg_temp.race_insert_parents VALUES(o,a,i,pay);
END $parents$;
