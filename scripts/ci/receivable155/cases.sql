CREATE TEMP TABLE results155(label text,shipment text,payload jsonb);
CREATE FUNCTION pg_temp.seed155(a_tax numeric DEFAULT 0,b_tax numeric DEFAULT 0,a_ret numeric DEFAULT 0)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  TRUNCATE embarques,conceptos_venta,conceptos_costo,seguros_embarque,facturas,conceptos_factura,
    factura_notas_credito,proveedor_facturas,proveedor_facturas_conceptos,proveedor_notas_credito,pagos_proveedor,pagos_factura;
  INSERT INTO embarques VALUES (pg_temp.id('A'),current_user_org_id(),20,22,NULL),(pg_temp.id('B'),current_user_org_id(),20,22,NULL);
  INSERT INTO facturas(id,embarque_id,subtotal,moneda,estado,total,tipo_cambio)
    VALUES(pg_temp.id('F'),pg_temp.id('A'),400,'MXN','Emitida',400+100*a_tax+300*b_tax-100*a_ret,1);
  INSERT INTO conceptos_factura(id,factura_id,embarque_id,total,descripcion,tipo_iva,tasa_iva_aplicada,monto_ret_isr)
    VALUES(pg_temp.id('A1'),pg_temp.id('F'),pg_temp.id('A'),100,'A',CASE a_tax WHEN .16 THEN 'gravado_16' WHEN .08 THEN 'gravado_8' ELSE 'tasa_0' END,a_tax,100*a_ret),
          (pg_temp.id('B1'),pg_temp.id('F'),pg_temp.id('B'),300,'B',CASE b_tax WHEN .16 THEN 'gravado_16' WHEN .08 THEN 'gravado_8' ELSE 'tasa_0' END,b_tax,0);
END $$;
CREATE FUNCTION pg_temp.nc155(base numeric,tax numeric DEFAULT 0,ret numeric DEFAULT 0,lineage text DEFAULT 'A1')
RETURNS void LANGUAGE sql AS $$
INSERT INTO factura_notas_credito(id,factura_id,monto,moneda,tipo_cambio,estado,conceptos)
VALUES(pg_temp.id('NC'),pg_temp.id('F'),base+round(base*tax,2)-round(base*ret,2),'MXN',1,'Timbrada',
jsonb_build_array(jsonb_build_object('cantidad',1,'precio_unitario',base,'tipo_iva',CASE tax WHEN .16 THEN 'gravado_16' WHEN .08 THEN 'gravado_8' ELSE 'tasa_0' END,
 'tasa_iva',tax,'tasa_ret_isr',ret,'concepto_factura_id',CASE WHEN lineage IS NOT NULL THEN pg_temp.id(lineage)::text END)))
$$;
CREATE FUNCTION pg_temp.pay155(amount numeric) RETURNS void LANGUAGE sql AS $$
INSERT INTO pagos_factura VALUES(pg_temp.id('PAY'),pg_temp.id('F'),amount,'NoAplica',NULL,pg_temp.id('A'))
$$;
CREATE FUNCTION pg_temp.check155(label text,a numeric,b numeric) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual jsonb; original jsonb; before_data jsonb; current_data jsonb; shipment text; expected numeric;
BEGIN
  FOREACH shipment IN ARRAY ARRAY['A','B'] LOOP
    expected:=CASE shipment WHEN 'A' THEN a ELSE b END;
    before_data:=jsonb_build_object('data',pg_temp.snapshot(),'payments',(SELECT jsonb_agg(to_jsonb(p)) FROM pagos_factura p));
    actual:=public.pnl_financiero_embarque(pg_temp.id(shipment));
    original:=pg_temp.reader_before155(pg_temp.id(shipment));
    current_data:=jsonb_build_object('data',pg_temp.snapshot(),'payments',(SELECT jsonb_agg(to_jsonb(p)) FROM pagos_factura p));
    PERFORM pg_temp.assert(before_data=current_data,label||': report changed data');
    PERFORM pg_temp.assert((actual#>>'{venta,pdte_cobro_mxn}')::numeric IS NOT DISTINCT FROM expected,
      label||' '||shipment||': pending expected '||coalesce(expected::text,'NULL')||' got '||coalesce(actual#>>'{venta,pdte_cobro_mxn}','NULL'));
    INSERT INTO results155 VALUES(label,shipment,actual);
    PERFORM pg_temp.assert(actual#-'{venta,pdte_cobro_mxn}'=original#-'{venta,pdte_cobro_mxn}',label||': non-receivable payload changed');
  END LOOP;
  RAISE NOTICE 'PASS155: %',label;
END $$;
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100);
SELECT pg_temp.check155('GUI A100 B300 NC100 selective',0,300);
SELECT pg_temp.pay155(150); SELECT pg_temp.check155('sole debtor after collection header A is not lineage',0,150);
UPDATE pagos_factura SET estado_rep='Cancelado'; SELECT pg_temp.check155('cancelled REP excluded',0,300);
UPDATE pagos_factura SET estado_rep='NoAplica',deleted_at=now(); SELECT pg_temp.check155('deleted collection excluded',0,300);
UPDATE pagos_factura SET deleted_at=NULL,monto_aplicado_factura=300; SELECT pg_temp.check155('fully collected',0,0);
UPDATE pagos_factura SET monto_aplicado_factura=301; SELECT pg_temp.check155('overpayment is not pending debt',0,0);
SELECT pg_temp.seed155(.16,.16); SELECT pg_temp.nc155(100,.16); SELECT pg_temp.check155('homogeneous VAT16',0,348);
SELECT pg_temp.seed155(.16,0); SELECT pg_temp.nc155(50,.16); SELECT pg_temp.check155('mixed VAT partial credit gross',58,300);
SELECT pg_temp.pay155(100); SELECT pg_temp.check155('ambiguous collection multiple positive debts',NULL,NULL);
UPDATE pagos_factura SET estado_rep='Cancelado'; SELECT pg_temp.check155('cancelled REP restores exact debts',58,300);
SELECT pg_temp.seed155(.16,.08,.1); SELECT pg_temp.nc155(50,.16,.1); SELECT pg_temp.check155('retained ISR and VAT8 sibling',53,324);
SELECT pg_temp.seed155(.16,0); UPDATE conceptos_factura SET monto_ret_iva=4 WHERE id=pg_temp.id('A1'); UPDATE facturas SET total=412;
SELECT pg_temp.nc155(50,.16); UPDATE factura_notas_credito SET monto=56,conceptos=jsonb_set(conceptos,'{0,tasa_ret_iva}','0.04');
SELECT pg_temp.check155('retained VAT',56,300);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET estado='Aplicada'; SELECT pg_temp.check155('applied credit',0,300);
UPDATE factura_notas_credito SET estado='Borrador'; SELECT pg_temp.check155('draft ignored',100,300);
UPDATE factura_notas_credito SET estado='Cancelada'; SELECT pg_temp.check155('cancelled credit ignored',100,300);
UPDATE factura_notas_credito SET estado='Timbrada',deleted_at=now(); SELECT pg_temp.check155('deleted credit ignored',100,300);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100,0,0,NULL); SELECT pg_temp.check155('legacy missing lineage unknown',NULL,NULL);
UPDATE conceptos_factura SET embarque_id=pg_temp.id('A'); SELECT pg_temp.check155('single shipment legacy canonical balance',300,0);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET conceptos=jsonb_set(conceptos,'{0,concepto_factura_id}','"not-a-uuid"'); SELECT pg_temp.check155('malformed identity unknown',NULL,NULL);
UPDATE factura_notas_credito SET conceptos=jsonb_set(conceptos,'{0,concepto_factura_id}',to_jsonb(pg_temp.id('A1')::text));
UPDATE conceptos_factura SET organization_id=pg_temp.id('foreign') WHERE id=pg_temp.id('A1'); SELECT pg_temp.check155('foreign identity unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET monto=99; SELECT pg_temp.check155('gross NC mismatch unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE facturas SET total=401; SELECT pg_temp.check155('gross invoice mismatch unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(101); SELECT pg_temp.check155('overcredited shipment unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET conceptos=conceptos#-'{0,tipo_iva}'; SELECT pg_temp.check155('missing fiscal metadata unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET conceptos=jsonb_set(conceptos,'{0,tasa_ret_isr}','"bad"'); SELECT pg_temp.check155('invalid tax numeric unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET conceptos=jsonb_set(conceptos,'{0,concepto_factura_id}',to_jsonb('  '||upper(pg_temp.id('A1')::text)||'  ')); SELECT pg_temp.check155('normalized identity',0,300);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(5); UPDATE factura_notas_credito SET moneda='USD',tipo_cambio=20; SELECT pg_temp.check155('USD credit into MXN invoice',0,300);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE facturas SET moneda='USD',tipo_cambio=20; UPDATE factura_notas_credito SET moneda='USD',tipo_cambio=20; SELECT pg_temp.check155('USD document valued once',0,6000);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE facturas SET moneda='EUR',tipo_cambio=22; UPDATE factura_notas_credito SET moneda='EUR',tipo_cambio=22; SELECT pg_temp.check155('EUR document valued once',0,6600);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(100); UPDATE factura_notas_credito SET moneda='USD',tipo_cambio=1; SELECT pg_temp.check155('missing credit FX unknown',NULL,NULL);
SELECT pg_temp.seed155(); SELECT pg_temp.nc155(0); SELECT pg_temp.check155('valid zero credit',100,300);
