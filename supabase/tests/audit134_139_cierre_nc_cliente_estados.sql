-- Preserve the effective AUD-ANALISIS-7 contract from migration20261001183654:
-- issued customer credit counts in closure detail; supplier lifecycle stays unchanged.
-- Ordinary same-company invoice/credit fixtures only. No lineage/security probes,
-- disabled protections, historical rewrites or remote operations.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
 o record; cli uuid:=gen_random_uuid(); e uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); n uuid:=gen_random_uuid(); st text;
 check_row jsonb; money_row jsonb; expected_credit numeric;
 invoice_before jsonb; credit_before jsonb; body text;
BEGIN
 SELECT * INTO STRICT o FROM pg_temp.seed_org_pair('CIERRE_NC_PRESERVE');
 INSERT INTO public.clientes(id,organization_id,nombre,email)
 VALUES(cli,o.org_a,'Closure credit preservation','closure-credit@test.local');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
 VALUES(e,o.org_a,cli,'DEMO-2026-134139','Aéreo','Importación');
 INSERT INTO public.facturas(id,organization_id,numero,cliente_id,embarque_id,subtotal,iva,total,
   moneda,tipo_cambio,estado,fecha_emision)
 VALUES(f,o.org_a,'CXC-CIERRE-NC',cli,e,100,16,116,'MXN',1,'Borrador',public.fecha_negocio_mx());
 INSERT INTO public.conceptos_factura(organization_id,factura_id,embarque_id,descripcion,cantidad,precio_unitario,total,moneda)
 VALUES(o.org_a,f,e,'Customer service',1,100,100,'MXN');
 UPDATE public.facturas SET estado='Emitida' WHERE id=f;
 INSERT INTO public.factura_notas_credito(id,organization_id,factura_id,folio,monto,moneda,tipo_cambio,
   estado,fecha_emision,conceptos,uuid_fiscal)
 VALUES(n,o.org_a,f,'CXC-CIERRE-NC',23.2,'MXN',1,'Borrador',public.fecha_negocio_mx(),
   '[{"cantidad":1,"precio_unitario":20,"tipo_iva":"gravado_16","tasa_iva":0.16}]',n::text);
 PERFORM pg_temp.as_user(o.admin_a);
 FOREACH st IN ARRAY ARRAY['Borrador','Timbrada','Aplicada','Cancelada'] LOOP
   UPDATE public.factura_notas_credito SET estado=st::public.estado_nota_credito WHERE id=n;
   expected_credit:=CASE WHEN st IN ('Timbrada','Aplicada') THEN 23.2 ELSE 0 END;
   SELECT to_jsonb(x) INTO invoice_before FROM public.facturas x WHERE id=f;
   SELECT to_jsonb(x) INTO credit_before FROM public.factura_notas_credito x WHERE id=n;
   SELECT x INTO STRICT check_row
     FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x
     WHERE x->>'regla'='cxc_cobrada';
   SELECT x INTO STRICT money_row FROM jsonb_array_elements(check_row->'detalle'->'por_moneda') x
     WHERE x->>'moneda'='MXN';
   PERFORM pg_temp.assert((money_row->>'notas_credito')::numeric IS NOT DISTINCT FROM expected_credit,
     'Customer closure credit detail must preserve Timbrada/Aplicada in state '||st||': '||money_row::text);
   PERFORM pg_temp.assert((money_row->>'saldo')::numeric IS NOT DISTINCT FROM 116-expected_credit
     AND (money_row->>'saldo')::numeric IS NOT DISTINCT FROM public.saldo_factura(f),
     'Closure detail and existing canonical customer balance must agree');
   PERFORM pg_temp.assert((money_row->>'total')::numeric IS NOT DISTINCT FROM
       (money_row->>'pagado')::numeric+(money_row->>'notas_credito')::numeric+(money_row->>'saldo')::numeric,
     'Customer invoice total must reconcile with payment, credit and residual');
   PERFORM pg_temp.assert((SELECT to_jsonb(x) FROM public.facturas x WHERE id=f) IS NOT DISTINCT FROM invoice_before
     AND (SELECT to_jsonb(x) FROM public.factura_notas_credito x WHERE id=n) IS NOT DISTINCT FROM credit_before,
     'Closure read must preserve persisted invoice and credit facts');
 END LOOP;
 -- Catalog preservation guard: check the actual replayed function, not a stale
 -- canonical file. This remains active in CI through the guards manifest.
 body:=regexp_replace(lower(pg_get_functiondef('public.validar_cierre_embarque(uuid)'::regprocedure)), '[[:space:]]+', '', 'g');
 PERFORM pg_temp.assert(position('fromfactura_notas_creditoncwherenc.factura_id=f.idandnc.deleted_atisnullandnc.estadoin(''timbrada'',''aplicada'')' in body)>0,
   'Effective closure must retain the customer lifecycle implemented by AUD-ANALISIS-7');
 IF position('fromproveedor_notas_creditonc' in body)>0 THEN
   PERFORM pg_temp.assert(array_length(string_to_array(body,'andnc.deleted_atisnullandnc.estado=''aplicada'''),1)-1=2,
     'Supplier amount and missing-FX branches must both remain Aplicada only');
 END IF;
 RAISE NOTICE 'Closure customer-credit preservation: four lifecycle states, reconciliation, unchanged facts and effective-definition guard passed';
END $tests$;
ROLLBACK;
