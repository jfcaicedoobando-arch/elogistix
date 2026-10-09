CREATE TABLE qa_results(phase text,label text,passed boolean,actual jsonb,expected jsonb);
CREATE FUNCTION qa_assert(p_label text,p_actual jsonb,p_expected jsonb) RETURNS void LANGUAGE sql AS $$
 INSERT INTO qa_results VALUES(current_setting('qa.phase'),p_label,p_actual IS NOT DISTINCT FROM p_expected,p_actual,p_expected)
$$;
CREATE FUNCTION qa_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE FUNCTION qa_reset() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 TRUNCATE proveedor_facturas,proveedor_facturas_conceptos,conceptos_costo,pagos_proveedor,proveedor_notas_credito,anticipos_aplicaciones;
END $$;
CREATE FUNCTION qa_invoice(n integer,t numeric,m text DEFAULT 'MXN',s estado_proveedor_factura DEFAULT 'Vigente') RETURNS void LANGUAGE sql AS $$
 INSERT INTO proveedor_facturas(id,organization_id,embarque_id,total,subtotal,moneda,estado,estado_captura)
 VALUES(qa_id(n),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',t,t,m,s,CASE WHEN s='Pagada' THEN 'pagada' ELSE 'capturada' END)
$$;
CREATE FUNCTION qa_payment(n integer,amount numeric,m text DEFAULT 'MXN',tc numeric DEFAULT 1,anticipo boolean DEFAULT false,applied numeric DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE i uuid:=gen_random_uuid(); fm text; BEGIN
 SELECT moneda INTO fm FROM proveedor_facturas WHERE id=qa_id(n);
 INSERT INTO pagos_proveedor(id,proveedor_factura_id,organization_id,monto,moneda,tipo_cambio_usd,monto_en_moneda_factura,es_anticipo_aplicado)
 VALUES(i,qa_id(n),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',amount,m,tc,CASE WHEN anticipo THEN applied ELSE monto_pago_en_moneda_factura(amount,m,tc,fm) END,anticipo);
 IF anticipo THEN INSERT INTO anticipos_aplicaciones VALUES(gen_random_uuid(),qa_id(n),i,NULL,applied); END IF;
 RETURN i;
END $$;
CREATE FUNCTION qa_nc(n integer,amount numeric,m text DEFAULT 'MXN',tc numeric DEFAULT 1) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE i uuid:=gen_random_uuid(); BEGIN
 INSERT INTO proveedor_notas_credito(id,proveedor_factura_id,organization_id,monto,moneda,tipo_cambio) VALUES(i,qa_id(n),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',amount,m,tc);
 RETURN i;
END $$;
CREATE FUNCTION qa_state(label text,n integer,expected text,capture text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$ DECLARE s text;c text; BEGIN
 PERFORM _recalc_estado_proveedor_factura(qa_id(n));
 SELECT estado::text,estado_captura INTO s,c FROM proveedor_facturas WHERE id=qa_id(n);
 PERFORM qa_assert(label,to_jsonb(s),to_jsonb(expected));
 IF capture IS NOT NULL THEN PERFORM qa_assert(label||' / captura',to_jsonb(c),to_jsonb(capture)); END IF;
END $$;
CREATE FUNCTION qa_guard(label text,expected boolean) RETURNS void LANGUAGE plpgsql AS $$ DECLARE j jsonb; BEGIN
 SELECT value INTO j FROM jsonb_array_elements(validar_cierre_embarque('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')->'checks') WHERE value->>'regla'='cxp_pagada';
 PERFORM qa_assert(label,j->'ok',to_jsonb(expected));
END $$;
CREATE FUNCTION qa_amount(label text,n integer,expected numeric) RETURNS void LANGUAGE sql AS $$
 SELECT qa_assert(label,to_jsonb(s.saldo),to_jsonb(expected)) FROM v_proveedor_facturas_saldo s WHERE s.proveedor_factura_id=qa_id(n)
$$;
