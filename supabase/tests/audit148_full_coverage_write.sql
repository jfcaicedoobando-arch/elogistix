-- Local candidate acceptance: ordinary writes on a complete disposable schema.
-- No production setup, identity/access changes, or persistent test helpers.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.coverage_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END $$;
CREATE FUNCTION pg_temp.coverage_reject(statement text,label text,expected text DEFAULT 'LC_SEGURO_COBERTURA_INCOMPLETA')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false; msg text;
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN check_violation THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF position(expected IN msg)=0 THEN RAISE; END IF;
  rejected:=true;
 END;
 PERFORM pg_temp.coverage_assert(rejected,label);
END $$;
CREATE FUNCTION pg_temp.policy(pf uuid,ship uuid,org uuid,premium numeric,currency text DEFAULT 'MXN')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.seguros_embarque(id,organization_id,embarque_id,aseguradora,numero_poliza,
  prima,moneda,vigencia_desde,vigencia_hasta,proveedor_factura_id)
 VALUES(result,org,ship,'Synthetic insurer',result::text,premium,currency,CURRENT_DATE,CURRENT_DATE+365,pf);
 RETURN result;
END $$;
CREATE FUNCTION pg_temp.invoice(ship uuid,org uuid,provider uuid,category uuid,base numeric,currency text DEFAULT 'MXN',tc numeric DEFAULT 20)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
  embarque_id,folio_proveedor,moneda,subtotal,iva,total,tipo_cambio_usd,estado)
 VALUES(result,org,provider,category,ship,result::text,currency::public.moneda,base,base*.16,base*1.16,tc,'Vigente');
 RETURN result;
END $$;
DO $cases$
DECLARE
 fx record; prov uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid(); cli uuid:=gen_random_uuid();
 e uuid:=gen_random_uuid(); other_e uuid:=gen_random_uuid(); pf uuid; s uuid; standalone uuid;
 cc uuid:=gen_random_uuid(); other_cc uuid:=gen_random_uuid(); adjust_cc uuid:=gen_random_uuid();
 line uuid; nc uuid; p jsonb; q numeric; rejected boolean; msg text; at_time timestamptz;
 before_row jsonb; old_count bigint; p2 uuid; s2 uuid; bank uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('COVERAGE148','admin_org');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo) VALUES(prov,fx.org_a,'Synthetic insurance supplier','Logistico','Naviera');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'Synthetic insurance');
 INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(cli,fx.org_a,'Synthetic client','coverage148@test.local');
 INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur)
 VALUES(e,fx.org_a,cli,'DEMO-2026-148901','Marítimo','Importación',20,22),
       (other_e,fx.org_a,cli,'DEMO-2026-148902','Marítimo','Importación',20,22);
 INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda,origen)
 VALUES(cc,fx.org_a,e,prov,'Allocation A',1000000,'MXN','manual'),
       (other_cc,fx.org_a,other_e,prov,'Allocation B',1000000,'MXN','manual'),
       (adjust_cc,fx.org_a,e,prov,'Budget adjustment',1000000,'MXN','ajuste_factura_proveedor');
 PERFORM pg_temp.as_user(fx.admin_a);
 standalone:=pg_temp.policy(NULL,e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert((SELECT proveedor_factura_id IS NULL FROM seguros_embarque WHERE id=standalone),'independent premium remains valid without invoice');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);
 UPDATE seguros_embarque SET proveedor_factura_id=pf WHERE id=standalone;
 PERFORM pg_temp.coverage_assert((SELECT proveedor_factura_id=pf FROM seguros_embarque WHERE id=standalone),'subsequent explicit full link accepted');
 s:=pg_temp.policy(pg_temp.invoice(e,fx.org_a,prov,cat,150),e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'invoice base larger than premium allows additional costs');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,60);
 SELECT count(*) INTO old_count FROM seguros_embarque;
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,100)',pf,e,fx.org_a),'insufficient new invoice rejected');
 PERFORM pg_temp.coverage_assert((SELECT count(*) FROM seguros_embarque)=old_count,'rejection has no partial policy insert');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);s:=pg_temp.policy(pf,e,fx.org_a,100);
 SELECT to_jsonb(x) INTO before_row FROM seguros_embarque x WHERE id=s;
 PERFORM pg_temp.coverage_reject(format('UPDATE seguros_embarque SET prima=100.01 WHERE id=%L',s),'premium-only increase revalidates');
 PERFORM pg_temp.coverage_reject(format('UPDATE seguros_embarque SET moneda=''USD'' WHERE id=%L',s),'currency-only change revalidates');
 PERFORM pg_temp.coverage_assert((SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s)=before_row,'rejected updates preserve entire policy');
 UPDATE proveedor_facturas SET subtotal=60,total=69.6 WHERE id=pf;
 UPDATE seguros_embarque SET proveedor_factura_id=pf,prima=100,moneda='MXN',notas='note-only full payload' WHERE id=s;
 PERFORM pg_temp.coverage_assert((SELECT notas='note-only full payload' AND proveedor_factura_id=pf FROM seguros_embarque WHERE id=s),'unchanged financial fields permit note-only historical edit');
 p:=pnl_financiero_embarque(e);
 PERFORM pg_temp.coverage_assert(p->'utilidad_mxn'='null'::jsonb AND p->>'estado_costos'='incompleto','reduced historical invoice leaves profit provisional');
 PERFORM pg_temp.coverage_reject(format('UPDATE seguros_embarque SET prima=101 WHERE id=%L',s),'effective change to insufficient historical link rejected');
 UPDATE seguros_embarque SET proveedor_factura_id=NULL WHERE id=s;
 PERFORM pg_temp.coverage_assert((SELECT proveedor_factura_id IS NULL FROM seguros_embarque WHERE id=s),'explicit unlink remains available');
 -- Allocation-only membership, partial split, header mismatch, quantity once.
 pf:=pg_temp.invoice(NULL,fx.org_a,prov,cat,200);
 INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,pf,cc,'2 x 50 A',2,50) RETURNING id INTO line;
 s:=pg_temp.policy(pf,e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'allocation-only invoice and quantity multiplied once');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 UPDATE proveedor_facturas_conceptos SET monto=20,cantidad=2 WHERE id=line;
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,100)',pf,e,fx.org_a),'partial allocation is not expanded to fiscal base');
 UPDATE proveedor_facturas SET embarque_id=other_e WHERE id=pf;
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,0)',pf,other_e,fx.org_a),'zero premium cannot revive header outside canonical attribution');
 UPDATE proveedor_facturas_conceptos SET monto=100,cantidad=1 WHERE id=line;
 INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,pf,other_cc,'Allocation B',1,100);
 UPDATE proveedor_facturas SET subtotal=150,total=174 WHERE id=pf;
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,100)',pf,e,fx.org_a),'over-allocation cap prevents manufactured coverage');
 s:=pg_temp.policy(pf,e,fx.org_a,75);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'proportional cap accepts exactly attributed75');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 -- Precision below one cent arises from proportional allocation, not rounded premium.
 UPDATE proveedor_facturas SET subtotal=199.99,total=231.9884 WHERE id=pf;
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,100)',pf,e,fx.org_a),'99.995 nominal attribution is below100 without epsilon');
 UPDATE proveedor_facturas SET subtotal=200.01,total=232.0116 WHERE id=pf;
 s:=pg_temp.policy(pf,e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'exact noncap100 allocation accepts invoice200.01');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 s:=pg_temp.policy(pf,e,fx.org_a,99.99);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'partial attribution above99.99 accepts without expanding or adding epsilon');
 -- Adjustment is ignored. Null/zero quantities keep the established effective1.
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);
 INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,pf,adjust_cc,'Ignored adjustment',1,1000);
 s:=pg_temp.policy(pf,e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'budget adjustment does not alter coverage');
 FOREACH q IN ARRAY ARRAY[0::numeric] LOOP
  pf:=pg_temp.invoice(NULL,fx.org_a,prov,cat,100);
  INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
  VALUES(fx.org_a,pf,cc,'Legacy quantity',q,100);
  s:=pg_temp.policy(pf,e,fx.org_a,100);
  PERFORM pg_temp.coverage_assert(s IS NOT NULL,'legacy null/zero quantity has effective1: '||coalesce(q::text,'NULL'));
 END LOOP;
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);
 INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
 VALUES(fx.org_a,pf,cc,'Negative quantity',-1,100);
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,0)',pf,e,fx.org_a),'negative effective quantity is indeterminate');
 PERFORM pg_temp.coverage_assert(coalesce(nullif(NULL::numeric,0),1)=1,'canonical NULL quantity expression remains1; actual column is NOT NULL');
 -- FX, nominal same-currency comparison and tax excluded from base.
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100,'USD',21);s:=pg_temp.policy(pf,e,fx.org_a,100,'USD');
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'same USD nominal coverage ignores distinct accounting FX');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100,'EUR',24);s:=pg_temp.policy(pf,e,fx.org_a,100,'EUR');
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'same EUR nominal coverage ignores distinct accounting FX');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100,'USD',21);s:=pg_temp.policy(pf,e,fx.org_a,2100,'MXN');
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'cross-currency uses invoice documented FX21');
 PERFORM pg_temp.coverage_reject(format('UPDATE seguros_embarque SET prima=2100.01 WHERE id=%L',s),'cross-currency insufficient base rejected despite invoice tax');
 UPDATE embarques SET tipo_cambio_usd=1 WHERE id=e;
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,2000,'MXN');
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,100,''USD'')',pf,e,fx.org_a),'missing premium valuation does not become zero');
 UPDATE embarques SET tipo_cambio_usd=20 WHERE id=e;
 -- Credit before link never makes coverage depend on net debt.
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);nc:=gen_random_uuid();
 INSERT INTO proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
 VALUES(nc,fx.org_a,pf,CURRENT_DATE,58,50,'MXN','Borrador');
 UPDATE proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
 UPDATE proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
 s:=pg_temp.policy(pf,e,fx.org_a,100);
 PERFORM pg_temp.coverage_assert(s IS NOT NULL,'credit before link does not reduce documented premium coverage');
 rejected:=false;
 BEGIN PERFORM pg_temp.policy(pf,e,fx.org_a,50);EXCEPTION WHEN unique_violation THEN rejected:=true;END;
 PERFORM pg_temp.coverage_assert(rejected,'existing unique active invoice rule retained');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 -- The narrow Papelera candidate now uses the real restore RPC.
 PERFORM restore_record('seguros_embarque',s);
 PERFORM pg_temp.coverage_assert((SELECT deleted_at IS NULL FROM seguros_embarque WHERE id=s),'insurance restore RPC rechecks valid coverage');
 UPDATE seguros_embarque SET deleted_at=now() WHERE id=s;
 UPDATE proveedor_facturas SET subtotal=60,total=69.6 WHERE id=pf;
 PERFORM pg_temp.coverage_reject(format('SELECT restore_record(''seguros_embarque'',%L)',s),'insufficient restore RPC rejects atomically');
 PERFORM pg_temp.coverage_assert((SELECT deleted_at IS NOT NULL FROM seguros_embarque WHERE id=s),'failed restore preserves deletion');
 -- Real cascade restore orders concepts -> policy -> shipment.
 -- Use a new shipment with one policy to isolate rollback/order assertions.
 e:=gen_random_uuid();cc:=gen_random_uuid();
 INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd,tipo_cambio_eur)
 VALUES(e,fx.org_a,cli,'DEMO-2026-148903','Marítimo','Importación',20,22);
 INSERT INTO conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
 VALUES(cc,fx.org_a,e,prov,'Cascade allocation',100,'MXN');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);s:=pg_temp.policy(pf,e,fx.org_a,100);
 at_time:=clock_timestamp();
 UPDATE conceptos_costo SET deleted_at=at_time WHERE id=cc;
 UPDATE seguros_embarque SET deleted_at=at_time WHERE id=s;
 UPDATE embarques SET deleted_at=at_time WHERE id=e;
 PERFORM restaurar_embarque_cascade(e);
 PERFORM pg_temp.coverage_assert((SELECT deleted_at IS NULL FROM embarques WHERE id=e)
  AND (SELECT deleted_at IS NULL FROM seguros_embarque WHERE id=s)
  AND (SELECT deleted_at IS NULL FROM conceptos_costo WHERE id=cc),'real cascade restores valid policy before shipment header');
 at_time:=clock_timestamp();
 UPDATE conceptos_costo SET deleted_at=at_time WHERE id=cc;
 UPDATE seguros_embarque SET deleted_at=at_time WHERE id=s;
 UPDATE embarques SET deleted_at=at_time WHERE id=e;
 UPDATE proveedor_facturas SET subtotal=60,total=69.6 WHERE id=pf;
 PERFORM pg_temp.as_postgres();
 SELECT jsonb_build_object('shipment',(SELECT to_jsonb(x) FROM embarques x WHERE id=e),
  'policy',(SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s),
  'concept',(SELECT to_jsonb(x) FROM conceptos_costo x WHERE id=cc)) INTO before_row;
 PERFORM pg_temp.as_user(fx.admin_a);
 PERFORM pg_temp.coverage_reject(format('SELECT restaurar_embarque_cascade(%L)',e),'insufficient cascade restore rejected');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.coverage_assert(jsonb_build_object('shipment',(SELECT to_jsonb(x) FROM embarques x WHERE id=e),
  'policy',(SELECT to_jsonb(x) FROM seguros_embarque x WHERE id=s),
  'concept',(SELECT to_jsonb(x) FROM conceptos_costo x WHERE id=cc))=before_row,
  'cascade failure rolls back already restored concepts and entire operation');
 PERFORM pg_temp.as_user(fx.admin_a);
 -- Isolated recognition/payment/credit lifecycle with both documents retained.
 e:=gen_random_uuid();
 INSERT INTO embarques(id,organization_id,cliente_id,expediente,modo,tipo,tipo_cambio_usd)
 VALUES(e,fx.org_a,cli,'DEMO-2026-148904','Marítimo','Importación',20);
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);
 INSERT INTO cuentas_bancarias(id,organization_id,alias,moneda,activa)
 VALUES(bank,fx.org_a,'Synthetic coverage bank','MXN',true);
 INSERT INTO proveedor_facturas_conceptos(organization_id,proveedor_factura_id,descripcion,cantidad,monto,iva)
 VALUES(fx.org_a,pf,'Synthetic fiscal premium',1,100,16);
 PERFORM aprobar_factura_proveedor(pf,true,'Synthetic coverage fixture invoice',(SELECT updated_at FROM proveedor_facturas WHERE id=pf));
 PERFORM registrar_pago_proveedor_atomico(pf,public.fecha_negocio_mx(),58,'MXN','Transferencia','Synthetic148',bank);
 s:=pg_temp.policy(pf,e,fx.org_a,100);
 p:=pnl_financiero_embarque(e);
 PERFORM pg_temp.coverage_assert((p->'costo'->>'real_mxn')::numeric=100
  AND (p->'costo'->>'pdte_pago_mxn')::numeric=58,'payment before link preserves one cost and only reduces debt');
 nc:=gen_random_uuid();
 INSERT INTO proveedor_notas_credito(id,organization_id,proveedor_factura_id,fecha,monto,subtotal,moneda,estado)
 VALUES(nc,fx.org_a,pf,CURRENT_DATE,58,50,'MXN','Borrador');
 UPDATE proveedor_notas_credito SET estado='Aprobada' WHERE id=nc;
 UPDATE proveedor_notas_credito SET estado='Aplicada' WHERE id=nc;
 UPDATE seguros_embarque SET prima=99 WHERE id=s;
 p:=pnl_financiero_embarque(e);
 PERFORM pg_temp.coverage_assert((p->'costo'->>'real_mxn')::numeric=50
  AND (p->'costo'->>'pdte_pago_mxn')::numeric=0,'credit after link reduces cost/debt without residual premium');
 PERFORM pg_temp.coverage_assert((SELECT count(*) FROM proveedor_facturas WHERE id=pf)=1
  AND (SELECT proveedor_factura_id=pf FROM seguros_embarque WHERE id=s),'invoice and policy are both retained with explicit identity');
 pf:=pg_temp.invoice(e,fx.org_a,prov,cat,100);s:=pg_temp.policy(pf,e,fx.org_a,100);
 PERFORM cancelar_factura_proveedor(pf,'Synthetic cancellation fixture');
 p:=pnl_financiero_embarque(e);
 PERFORM pg_temp.coverage_assert((SELECT proveedor_factura_id=pf FROM seguros_embarque WHERE id=s)
  AND p->'utilidad_mxn'='null'::jsonb AND (p->'costo'->>'real_mxn')::numeric=50,
  'later cancellation keeps relationship and provisional P&L without adding premium');
 PERFORM pg_temp.coverage_reject(format('SELECT pg_temp.policy(%L,%L,%L,0)',pf,e,fx.org_a),
  'zero premium cannot link a cancelled invoice','LC_SEGURO_FACTURA_INVALIDA');
 PERFORM pg_temp.as_user(fx.admin_b);
 PERFORM pg_temp.coverage_assert((SELECT count(*) FROM seguros_embarque WHERE organization_id=fx.org_a)=0,'other organization insurance rows remain invisible');
 PERFORM pg_temp.as_postgres();
END $cases$;
ROLLBACK;
