-- Ordinary local allocation fixtures; all data changes roll back.
-- Attribution of invoice-level payments/credits is computed, not new payment lineage.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE OR REPLACE FUNCTION pg_temp.assert_cierre_atribuido(e uuid, factor numeric)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE c jsonb; m jsonb;
BEGIN
  SELECT x INTO STRICT c FROM jsonb_array_elements(public.validar_cierre_embarque(e)->'checks') x
    WHERE x->>'regla'='cxp_pagada';
  IF factor=0 THEN
    PERFORM pg_temp.assert(jsonb_array_length(c->'detalle'->'por_moneda')=0 AND (c->>'ok')::boolean,
      'No live allocation and no fallback header must mean no invoice membership');
    RETURN;
  END IF;
  SELECT x INTO STRICT m FROM jsonb_array_elements(c->'detalle'->'por_moneda') x WHERE x->>'moneda'='MXN';
  PERFORM pg_temp.assert((m->>'total')::numeric IS NOT DISTINCT FROM 116*factor
    AND (m->>'pagado')::numeric IS NOT DISTINCT FROM 46.4*factor
    AND (m->>'notas_credito')::numeric IS NOT DISTINCT FROM 23.2*factor
    AND (m->>'saldo')::numeric IS NOT DISTINCT FROM 46.4*factor,
    'Total, invoice-level payment, credit and residual must use the same canonical factor: ' || m::text);
  PERFORM pg_temp.assert(NOT (c->>'ok')::boolean
    AND (m->>'facturas_pendientes')::int IS NOT DISTINCT FROM 1,
    'A material attributed debt must block closure and count its invoice once');
  PERFORM pg_temp.assert((m->>'reparto_proporcional')::boolean IS NOT DISTINCT FROM (factor<1),
    'A proportional attribution must be explicitly identified');
END $$;
DO $tests$
DECLARE fx record; cli uuid:=gen_random_uuid(); prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); h uuid:=gen_random_uuid();
  ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid(); ajuste uuid:=gen_random_uuid();
  f uuid:=gen_random_uuid(); n uuid:=gen_random_uuid(); before_pago jsonb;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD139ATTR');
  INSERT INTO public.clientes(id,organization_id,nombre,email)
    VALUES(cli,fx.org_a,'Attribution client','attribution@test.local');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
    VALUES(prov,fx.org_a,'Attribution supplier','Logistico','Naviera');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre)
    VALUES(cat,fx.org_a,'Attribution cost');
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(a,fx.org_a,cli,'DEMO-2026-139101','Aéreo','Importación'),
          (b,fx.org_a,cli,'DEMO-2026-139102','Aéreo','Importación'),
          (h,fx.org_a,cli,'DEMO-2026-139103','Aéreo','Importación');
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,origen)
    VALUES(ca,fx.org_a,a,prov,'A',150,'MXN','manual'),
          (cb,fx.org_a,b,prov,'B',50,'MXN','manual'),
          (ajuste,fx.org_a,h,prov,'Budget adjustment',0,'MXN','ajuste_factura_proveedor');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,embarque_id,folio_proveedor,categoria_presupuesto_id,
    fecha_emision,subtotal,iva,total,moneda,estado,estado_aprobacion)
    VALUES(f,fx.org_a,prov,h,'ATTR139',cat,public.fecha_negocio_mx(),100,16,116,'MXN','Vigente','aprobada');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,f,ca,'Allocation A quantity2',2,25),
          (fx.org_a,f,cb,'Allocation B',1,50);
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM public.aprobar_factura_proveedor(f,true,'Synthetic allocation test without attachment',
    (SELECT updated_at FROM public.proveedor_facturas WHERE id=f));
  INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,fecha_pago,monto,moneda,metodo_pago)
    VALUES(fx.org_a,f,public.fecha_negocio_mx(),46.4,'MXN','Efectivo');
  INSERT INTO public.proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
    VALUES(n,fx.org_a,f,public.fecha_negocio_mx(),23.2,20,'MXN','Borrador');
  UPDATE public.proveedor_notas_credito SET estado='Aprobada' WHERE id=n;
  UPDATE public.proveedor_notas_credito SET estado='Aplicada' WHERE id=n;
  -- A later budget-adjustment link must not acquire shipment membership.
  -- Approval can reset normally; no further payment/approval is forced.
  INSERT INTO public.proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(fx.org_a,f,ajuste,'Excluded budget adjustment',1,999);
  SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO before_pago FROM public.pagos_proveedor p WHERE proveedor_factura_id=f;
  PERFORM pg_temp.assert_cierre_atribuido(a,0.5);
  PERFORM pg_temp.assert_cierre_atribuido(b,0.5);
  PERFORM pg_temp.assert_cierre_atribuido(h,0);
  UPDATE public.proveedor_facturas SET embarque_id=NULL WHERE id=f;
  PERFORM pg_temp.assert_cierre_atribuido(a,0.5);
  -- Positive unit price with a negative quantity is not positive membership.
  UPDATE public.proveedor_facturas_conceptos SET cantidad=-1 WHERE proveedor_factura_id=f AND concepto_costo_id=cb;
  PERFORM pg_temp.assert_cierre_atribuido(a,0.5);
  PERFORM pg_temp.assert_cierre_atribuido(b,0);
  UPDATE public.proveedor_facturas_conceptos SET cantidad=1 WHERE proveedor_factura_id=f AND concepto_costo_id=cb;
  -- Underallocation is never expanded to consume the unassigned residue.
  UPDATE public.proveedor_facturas_conceptos SET monto=0 WHERE proveedor_factura_id=f AND concepto_costo_id=cb;
  UPDATE public.proveedor_facturas_conceptos SET monto=12.5 WHERE proveedor_factura_id=f AND concepto_costo_id=ca;
  PERFORM pg_temp.assert_cierre_atribuido(a,0.25);
  PERFORM pg_temp.assert_cierre_atribuido(b,0);
  -- The seeded cost budget permits the link; fiscal base still caps overassignment.
  -- Overassignment is capped proportionally against the complete invoice.
  UPDATE public.proveedor_facturas_conceptos SET monto=75 WHERE proveedor_factura_id=f AND concepto_costo_id=ca;
  UPDATE public.proveedor_facturas_conceptos SET monto=50 WHERE proveedor_factura_id=f AND concepto_costo_id=cb;
  PERFORM pg_temp.assert_cierre_atribuido(a,0.75);
  PERFORM pg_temp.assert_cierre_atribuido(b,0.25);
  -- Removing one concept removes that membership; the survivor stays partial.
  PERFORM public.soft_delete_record('conceptos_costo',ca);
  PERFORM pg_temp.assert_cierre_atribuido(a,0);
  PERFORM pg_temp.assert_cierre_atribuido(b,0.5);
  PERFORM pg_temp.assert((SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.pagos_proveedor p WHERE proveedor_factura_id=f)=before_pago,
    'Attribution must never rewrite or manufacture payment-to-shipment lineage');
  RAISE NOTICE 'Audit139: quantity, NULL/unrelated header, under/overallocation and inactive links passed';
END $tests$;
ROLLBACK;
