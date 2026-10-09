-- Actual reader, synthetic data only. The runner owns a fresh local database.
-- No F11, NC3, fiscal service, real tenant, or deployed database is accessed.
CREATE TEMP TABLE results144(label text PRIMARY KEY, payload jsonb);
CREATE FUNCTION pg_temp.seed144() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  TRUNCATE embarques, conceptos_venta, conceptos_costo, seguros_embarque, facturas, conceptos_factura,
    factura_notas_credito, proveedor_facturas, proveedor_facturas_conceptos, proveedor_notas_credito, pagos_proveedor;
  INSERT INTO embarques VALUES
    (pg_temp.id('A'),current_user_org_id(),20,22,NULL),
    (pg_temp.id('B'),current_user_org_id(),20,22,NULL);
  INSERT INTO facturas(id,embarque_id,subtotal,moneda,estado,total,tipo_cambio)
    VALUES(pg_temp.id('F'),pg_temp.id('A'),400,'MXN','Emitida',464,1);
  INSERT INTO conceptos_factura(id,factura_id,embarque_id,total,descripcion) VALUES
    (pg_temp.id('A1'),pg_temp.id('F'),pg_temp.id('A'),60,'A seleccionado'),
    (pg_temp.id('A2'),pg_temp.id('F'),pg_temp.id('A'),40,'A no seleccionado'),
    (pg_temp.id('B1'),pg_temp.id('F'),pg_temp.id('B'),300,'B intacto');
  INSERT INTO conceptos_costo VALUES
    (pg_temp.id('costA'),current_user_org_id(),pg_temp.id('A'),'Costo A','MXN',20,pg_temp.id('P'),'Synthetic provider','manual',NULL),
    (pg_temp.id('costB'),current_user_org_id(),pg_temp.id('B'),'Costo B','MXN',30,pg_temp.id('P'),'Synthetic provider','manual',NULL);
  INSERT INTO proveedor_facturas VALUES
    (pg_temp.id('PFA'),current_user_org_id(),pg_temp.id('A'),pg_temp.id('P'),'Synthetic provider',20,20,'MXN','Vigente',NULL,NULL,NULL),
    (pg_temp.id('PFB'),current_user_org_id(),pg_temp.id('B'),pg_temp.id('P'),'Synthetic provider',30,30,'MXN','Vigente',NULL,NULL,NULL);
  INSERT INTO proveedor_facturas_conceptos VALUES
    (pg_temp.id('linkA'),pg_temp.id('PFA'),pg_temp.id('costA'),'Costo A',20,1),
    (pg_temp.id('linkB'),pg_temp.id('PFB'),pg_temp.id('costB'),'Costo B',30,1);
END $$;
CREATE FUNCTION pg_temp.line144(amount numeric, lineage text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('cantidad',1,'precio_unitario',amount,'tasa_iva',0.16,
   'concepto_factura_id',lineage,'descripcion','No usar este texto para resolver el concepto')
$$;
CREATE FUNCTION pg_temp.nc144(lines jsonb,state text DEFAULT 'Timbrada',currency text DEFAULT 'MXN',rate numeric DEFAULT 1)
RETURNS void LANGUAGE sql AS $$
 INSERT INTO factura_notas_credito(id,factura_id,monto,moneda,tipo_cambio,estado,conceptos)
 VALUES(pg_temp.id('NC'),pg_temp.id('F'),999,currency,rate,state,lines)
$$;
CREATE FUNCTION pg_temp.check144(label text,shipment text,sale numeric,proportional integer DEFAULT 0,
  bad_base integer DEFAULT 0,bad_fx integer DEFAULT 0,active integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql AS $$ DECLARE p jsonb; before_data jsonb; BEGIN
 before_data := pg_temp.snapshot(); p := public.pnl_financiero_embarque(pg_temp.id(shipment));
 PERFORM pg_temp.assert(before_data=pg_temp.snapshot(),label||': data changed');
 PERFORM pg_temp.assert((p#>>'{venta,real_mxn}')::numeric IS NOT DISTINCT FROM sale,label||': sale '||p);
 PERFORM pg_temp.assert((p#>>'{ingresos_documentacion,repartos_provisionales}')::int=proportional,label||': provisional '||p);
 PERFORM pg_temp.assert((p#>>'{ingresos_documentacion,notas_credito_sin_base}')::int=bad_base,label||': base '||p);
 PERFORM pg_temp.assert((p#>>'{ingresos_documentacion,notas_credito_sin_valoracion}')::int=bad_fx,label||': FX '||p);
 PERFORM pg_temp.assert((p#>>'{ingresos_documentacion,notas_credito_activas}')::int=active,label||': active '||p);
 PERFORM pg_temp.assert((p->>'estado_ingresos'='incompleto')=(proportional+bad_base+bad_fx>0),label||': state '||p);
 IF proportional+bad_base+bad_fx>0 THEN
  PERFORM pg_temp.assert(p->'utilidad_mxn'='null'::jsonb AND p->'margen_real_pct'='null'::jsonb,label||': false profit');
 ELSE
  PERFORM pg_temp.assert((p->>'utilidad_mxn')::numeric=round(sale-CASE WHEN shipment='A' THEN 20 ELSE 30 END,2),label||': known profit '||p);
  PERFORM pg_temp.assert((SELECT sum((x->>'real_mxn')::numeric) FROM jsonb_array_elements(p->'por_concepto')x)=sale,label||': detail mismatch '||p);
 END IF;
 INSERT INTO results144 VALUES(label,p); RAISE NOTICE 'PASS144: %',label;
END $$;

SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text)));
SELECT pg_temp.check144('selective A only','A',40);
SELECT pg_temp.check144('other shipment unchanged','B',300);
SELECT pg_temp.assert((SELECT (x->>'real_mxn')::numeric FROM jsonb_array_elements(public.pnl_financiero_embarque(pg_temp.id('A'))->'por_concepto')x WHERE x->>'concepto'='a seleccionado')=0,'selected concept alone is credited');
SELECT pg_temp.assert((SELECT (x->>'real_mxn')::numeric FROM jsonb_array_elements(public.pnl_financiero_embarque(pg_temp.id('A'))->'por_concepto')x WHERE x->>'concepto'='a no seleccionado')=40,'same-shipment sibling unchanged');
UPDATE factura_notas_credito SET estado='Aplicada';
SELECT pg_temp.check144('Aplicada same exact amount','A',40);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text),pg_temp.line144(40,pg_temp.id('A2')::text));
SELECT pg_temp.check144('all selected A 0','A',0);
SELECT pg_temp.check144('all selected B 300','B',300);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(60,'  '||upper(pg_temp.id('A1')::text)||'  '));
SELECT pg_temp.check144('normalized UUID identity','A',40);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(30,pg_temp.id('A1')::text),pg_temp.line144(20));
SELECT pg_temp.check144('mixed exact and fallback A','A',65,1);
SELECT pg_temp.check144('mixed exact and fallback B','B',285,1);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(60));
SELECT pg_temp.check144('legacy multi A','A',85,1);
SELECT pg_temp.check144('legacy multi B','B',255,1);
DELETE FROM conceptos_factura WHERE embarque_id=pg_temp.id('B');
UPDATE facturas SET subtotal=100;
SELECT pg_temp.check144('legacy single still warned','A',40,1);

DO $$ DECLARE invalid text; BEGIN
 FOREACH invalid IN ARRAY ARRAY['',' ', 'not-a-uuid','------------------------------------',pg_temp.id('orphan')::text] LOOP
  PERFORM pg_temp.seed144();
  PERFORM pg_temp.nc144(jsonb_build_array(pg_temp.line144(60,invalid)));
  PERFORM pg_temp.check144('invalid lineage '||invalid,'A',85,1);
 END LOOP;
END $$;
SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text)));
UPDATE conceptos_factura SET organization_id=pg_temp.id('foreign') WHERE id=pg_temp.id('A1');
SELECT pg_temp.check144('foreign concept is provisional','A',85,1);
UPDATE conceptos_factura SET organization_id=current_user_org_id(),embarque_id=NULL WHERE id=pg_temp.id('A1');
SELECT pg_temp.check144('unassigned concept is provisional','A',47.06-60*(40::numeric/340),1);

SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(3,pg_temp.id('A1')::text)),'Timbrada','USD',20);
SELECT pg_temp.check144('base USD 3 converted not gross999','A',40);
SELECT pg_temp.check144('FX does not debit B','B',300);
UPDATE factura_notas_credito SET moneda='EUR',tipo_cambio=22;
SELECT pg_temp.check144('EUR base conversion','A',34);
UPDATE facturas SET moneda='USD',tipo_cambio=20;
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(10,pg_temp.id('A1')::text));
SELECT pg_temp.check144('EUR to USD to MXN','A',1780);
UPDATE factura_notas_credito SET tipo_cambio=NULL;
SELECT pg_temp.check144('unknown FX stays incomplete','A',2000,0,0,1);

SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(0,pg_temp.id('A1')::text)));
SELECT pg_temp.check144('valid zero exact credit','A',100);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(3,pg_temp.id('A1')::text)||'{"cantidad":2.5,"precio_unitario":1.234,"descuento":99,"tasa_ret_isr":0.1}'::jsonb);
SELECT pg_temp.check144('round product and no double discount','A',96.91);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text),'{"cantidad":"invalid","precio_unitario":1}'::jsonb);
SELECT pg_temp.check144('one invalid economic line invalidates whole note','A',100,0,1);
UPDATE factura_notas_credito SET conceptos='[]';
SELECT pg_temp.check144('unknown historical base not gross','A',100,0,1);
UPDATE factura_notas_credito SET conceptos=jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text));
UPDATE factura_notas_credito SET estado='Cancelada';
SELECT pg_temp.check144('cancelled NC ignored','A',100,0,0,0,0);
UPDATE factura_notas_credito SET estado='Borrador';
SELECT pg_temp.check144('draft NC ignored','A',100,0,0,0,0);
UPDATE factura_notas_credito SET estado='Timbrada',deleted_at=now();
SELECT pg_temp.check144('deleted NC ignored','A',100,0,0,0,0);

SELECT pg_temp.seed144();
DELETE FROM conceptos_factura WHERE embarque_id=pg_temp.id('B');
UPDATE facturas SET subtotal=100,total=116;
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(60,pg_temp.id('A1')::text)));
SELECT pg_temp.check144('single shipment two concepts selective','A',40);
SELECT pg_temp.assert((SELECT (x->>'real_mxn')::numeric FROM jsonb_array_elements(public.pnl_financiero_embarque(pg_temp.id('A'))->'por_concepto')x WHERE x->>'concepto'='a no seleccionado')=40,'single-shipment sibling intact');
INSERT INTO factura_notas_credito(id,factura_id,monto,moneda,tipo_cambio,estado,conceptos)
 VALUES(pg_temp.id('NC2-synthetic'),pg_temp.id('F'),46.40,'MXN',1,'Timbrada',jsonb_build_array(pg_temp.line144(40,pg_temp.id('A2')::text)));
SELECT pg_temp.check144('two active exact NC to distinct concepts','A',0,0,0,0,2);
SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(30,pg_temp.id('A1')::text),pg_temp.line144(30,pg_temp.id('B1')::text)));
SELECT pg_temp.check144('exact NC spans two shipments A','A',70);
SELECT pg_temp.check144('exact NC spans two shipments B','B',270);
SELECT pg_temp.seed144();
SELECT pg_temp.nc144(jsonb_build_array(pg_temp.line144(0,pg_temp.id('A1')::text))||'[{"cantidad":1,"precio_unitario": "1e131072"}]'::jsonb);
SELECT pg_temp.check144('overflow invalidates whole note','A',100,0,1);

-- Thirty small FX lines: convert the cumulative economic base, never thirty
-- independently rounded credits. The final line belongs to the OTHER shipment.
SELECT pg_temp.seed144();
UPDATE facturas SET moneda='USD',tipo_cambio=1.777;
SELECT pg_temp.nc144((SELECT jsonb_agg(pg_temp.line144(0.01,pg_temp.id(CASE WHEN i<=15 THEN 'A1' ELSE 'B1' END)::text) ORDER BY i)
 FROM generate_series(1,30)i),'Timbrada','EUR',1.333);
SELECT pg_temp.check144('30 tiny FX lines A','A',177.5001);
SELECT pg_temp.check144('30 tiny FX lines B last line','B',532.9);
SELECT pg_temp.assert((public.pnl_financiero_embarque(pg_temp.id('A'))#>>'{venta,real_mxn}')::numeric
 +(public.pnl_financiero_embarque(pg_temp.id('B'))#>>'{venta,real_mxn}')::numeric
 = public.a_mxn(400-public.nc_convertida_a_moneda_factura(.30,'EUR',1.333,'USD',1.777),'USD',1.777,1.777),
 '30 tiny lines conserve total converted NC / aggregate net');
DELETE FROM conceptos_factura WHERE embarque_id=pg_temp.id('B');
UPDATE facturas SET subtotal=100;
UPDATE factura_notas_credito SET conceptos=(SELECT jsonb_agg(pg_temp.line144(0.01,pg_temp.id('A1')::text) ORDER BY i) FROM generate_series(1,30)i);
SELECT pg_temp.check144('30 tiny FX lines single shipment preserves132','A',177.3001);
SELECT pg_temp.assert((public.pnl_financiero_embarque(pg_temp.id('A'))#>>'{venta,real_mxn}')::numeric
 = public.a_mxn(100-public.nc_convertida_a_moneda_factura(.30,'EUR',1.333,'USD',1.777),'USD',1.777,1.777),
 'single shipment is literal132 total-base valuation');
SELECT pg_temp.seed144();
UPDATE facturas SET moneda='USD',tipo_cambio=1.777;
-- The foreign concept is unrelated to this invoice and is never attributed exactly.
INSERT INTO conceptos_factura(id,factura_id,embarque_id,total,descripcion,organization_id)
 VALUES(pg_temp.id('foreign-line'),pg_temp.id('other-invoice'),pg_temp.id('other-shipment'),9000,'Foreign secret label',pg_temp.id('other-tenant'));
SELECT pg_temp.nc144((SELECT jsonb_agg(pg_temp.line144(0.01,CASE WHEN i=30 THEN pg_temp.id('foreign-line')::text ELSE pg_temp.id(CASE WHEN i<=15 THEN 'A1' ELSE 'B1' END)::text END) ORDER BY i)
 FROM generate_series(1,30)i),'Timbrada','EUR',1.333);
SELECT pg_temp.check144('30 FX last foreign lineage fallback A','A',177.496775,1);
SELECT pg_temp.check144('30 FX last foreign lineage fallback B','B',532.903325,1);
SELECT pg_temp.assert(public.pnl_financiero_embarque(pg_temp.id('A'))::text NOT LIKE '%Foreign secret label%', 'foreign concept not read into detail');
SELECT pg_temp.assert((public.pnl_financiero_embarque(pg_temp.id('A'))#>>'{venta,real_mxn}')::numeric
 +(public.pnl_financiero_embarque(pg_temp.id('B'))#>>'{venta,real_mxn}')::numeric=710.4001,
 'mixed legacy remains provisional and conserves total');
