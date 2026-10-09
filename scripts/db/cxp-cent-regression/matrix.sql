-- The identical contract matrix runs against unmodified live and candidate functions.
-- Financial amounts come from persisted fixture rows + exact live view/converters.
DO $$
DECLARE m text;i uuid;r jsonb;
BEGIN
 FOREACH m IN ARRAY ARRAY['MXN','USD'] LOOP
  PERFORM qa_reset(); PERFORM qa_invoice(1,0.01,m);
  PERFORM qa_guard(m||' whole cent unpaid guard',false);
  PERFORM qa_state(m||' whole cent unpaid state',1,'Vigente','capturada');
  PERFORM qa_amount(m||' unpaid balance unchanged',1,0.01);
  i:=qa_payment(1,0.01,m);
  PERFORM qa_state(m||' exact cent paid state',1,'Pagada','pagada');
  PERFORM qa_guard(m||' exact cent paid guard',true);
  PERFORM qa_amount(m||' paid balance',1,0);
  UPDATE pagos_proveedor SET deleted_at=now() WHERE id=i;
  PERFORM qa_state(m||' full payment reversed state',1,'Vigente','capturada');
  PERFORM qa_guard(m||' full payment reversed guard',false);
 END LOOP;

 PERFORM qa_reset(); PERFORM qa_invoice(1,100);PERFORM qa_payment(1,99.99);
 PERFORM qa_state('legacy cent residual after payment',1,'Pagada');PERFORM qa_guard('legacy cent residual guard',true);PERFORM qa_amount('legacy residual is not written off',1,0.01);
 PERFORM qa_reset(); PERFORM qa_invoice(1,0.02);PERFORM qa_payment(1,0.01);
 PERFORM qa_state('small partial payment retains inclusive contract',1,'Pagada');PERFORM qa_guard('small partial residual guard',true);

 PERFORM qa_reset(); PERFORM qa_invoice(1,0.01);i:=qa_nc(1,0.01);
 PERFORM qa_state('credit only fully covers',1,'Pagada');PERFORM qa_guard('credit only guard',true);
 UPDATE proveedor_notas_credito SET estado='Borrador' WHERE id=i;
 PERFORM qa_state('credit draft no coverage',1,'Vigente');PERFORM qa_guard('credit draft guard',false);
 UPDATE proveedor_notas_credito SET estado='Aplicada',deleted_at=now() WHERE id=i;
 PERFORM qa_state('credit deleted no coverage',1,'Vigente');PERFORM qa_guard('credit deleted guard',false);

 PERFORM qa_reset(); PERFORM qa_invoice(1,0.01);i:=qa_payment(1,0.01,'MXN',1,true,0.01);
 PERFORM qa_state('advance exact state',1,'Pagada');PERFORM qa_guard('advance exact guard',true);PERFORM qa_amount('advance counted once',1,0);
 UPDATE anticipos_aplicaciones SET deleted_at=now() WHERE pago_proveedor_id=i;
 UPDATE pagos_proveedor SET deleted_at=now() WHERE id=i;
 PERFORM qa_state('advance reversed state',1,'Vigente');PERFORM qa_guard('advance reversed guard',false);

 PERFORM qa_reset(); PERFORM qa_invoice(1,0.01);PERFORM qa_payment(1,0.01);PERFORM qa_payment(1,-0.01);
 PERFORM qa_state('signed payment reversal nets zero',1,'Vigente');PERFORM qa_guard('signed payment reversal guard',false);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01);PERFORM qa_payment(1,-0.01);
 PERFORM qa_state('negative net coverage',1,'Vigente');PERFORM qa_guard('negative net coverage guard',false);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01);PERFORM qa_payment(1,-0.01);PERFORM qa_nc(1,0.01);
 PERFORM qa_state('payment and credit net zero',1,'Vigente');PERFORM qa_guard('payment and credit net zero guard',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,0.01);PERFORM qa_invoice(2,100);PERFORM qa_payment(2,100);
 PERFORM qa_guard('another paid invoice cannot hide unpaid cent',false);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'USD');PERFORM qa_invoice(2,100,'MXN');PERFORM qa_payment(2,101);
 PERFORM qa_guard('MXN overpayment cannot hide USD cent',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,100);PERFORM qa_payment(1,99.99);PERFORM qa_invoice(2,100);PERFORM qa_payment(2,99.99);
 PERFORM qa_guard('accumulated residuals > cent stay blocked',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,0.01);
 INSERT INTO conceptos_costo(id,embarque_id,organization_id) VALUES(qa_id(101),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),(qa_id(102),'cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 INSERT INTO proveedor_facturas_conceptos(id,proveedor_factura_id,concepto_costo_id,monto) VALUES(qa_id(201),qa_id(1),qa_id(101),0.001),(qa_id(202),qa_id(1),qa_id(102),0.009);
 PERFORM qa_guard('allocation factor 0.1 cannot hide whole unpaid cent',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'USD');PERFORM qa_payment(1,0.18,'MXN',18);
 PERFORM qa_state('FX exact cent payment state',1,'Pagada');PERFORM qa_guard('FX exact cent payment guard',true);PERFORM qa_amount('FX exact cent balance',1,0);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'MXN');PERFORM qa_nc(1,0.0005,'USD',20);
 PERFORM qa_state('FX credit covers cent',1,'Pagada');PERFORM qa_guard('FX credit guard',true);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'USD');PERFORM qa_payment(1,0.18,'MXN',0);
 PERFORM qa_guard('missing FX conversion blocks guard',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'MXN','Cancelada');
 PERFORM qa_state('Cancelada never changes',1,'Cancelada');PERFORM qa_guard('Cancelada excluded from guard',true);
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01,'MXN','Borrador');
 PERFORM qa_state('Borrador never changes',1,'Borrador');PERFORM qa_guard('Borrador debt does not bypass guard',false);

 PERFORM qa_reset();PERFORM qa_invoice(1,NULL);
 PERFORM qa_state('NULL balance does not invent paid',1,'Vigente');
 PERFORM qa_reset();PERFORM qa_invoice(1,0.01);UPDATE proveedor_facturas SET deleted_at=now() WHERE id=qa_id(1);
 PERFORM qa_state('missing view row does not invent paid',1,'Vigente');
 PERFORM _recalc_estado_proveedor_factura(qa_id(999));
 PERFORM qa_assert('unknown invoice no row created',to_jsonb((SELECT COUNT(*) FROM proveedor_facturas WHERE id=qa_id(999))),to_jsonb(0::bigint));

 PERFORM qa_reset();PERFORM qa_invoice(1,100,'MXN','Pagada');PERFORM qa_payment(1,99.99);
 PERFORM qa_state('historical paid residual remains paid',1,'Pagada');PERFORM qa_guard('historical residual closure compatibility',true);
 PERFORM qa_reset();PERFORM qa_invoice(1,0);
 PERFORM qa_state('zero total state',1,'Pagada');PERFORM qa_guard('zero total guard',true);
END $$;
