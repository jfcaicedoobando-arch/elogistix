-- AUD100: salida bruta y entrada de devolución en sus fechas; sin backfill.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  prov uuid := gen_random_uuid();
  cat uuid := gen_random_uuid();
  doc uuid := gen_random_uuid();
  cta uuid := gen_random_uuid();
  usd uuid := gen_random_uuid();
  ant public.anticipos_proveedor;
  parcial public.anticipos_proveedor;
  divisa public.anticipos_proveedor;
  aplic public.anticipos_aplicaciones;
  data jsonb;
  row_ jsonb;
  neto numeric;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD100');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES(prov,fx.org_a,'AUD100 proveedor','GastoOperativo','Otros');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'AUD100 categoria');
  INSERT INTO public.cuentas_bancarias(id,organization_id,alias,moneda,fecha_saldo_inicial)
    VALUES(cta,fx.org_a,'AUD100 MXN','MXN',hoy-20),(usd,fx.org_a,'AUD100 USD','USD',hoy-20);
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,
    fecha_emision,fecha_vencimiento,moneda,subtotal,total,estado,estado_aprobacion)
    VALUES(doc,fx.org_a,prov,cat,'AUD100-FP',hoy-10,hoy+10,'MXN',100,100,'Vigente','aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  ant:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>0.03,p_moneda=>'MXN',
    p_fecha_anticipo=>hoy-9,p_metodo_pago=>'Transferencia',p_cuenta_bancaria_id=>cta,p_referencia=>'Reserva documental');
  ant:=public.devolver_anticipo_proveedor(ant.id,0.03,hoy-5,cta,'Devolución de reserva documental','Reembolso de reserva');
  data:=public.libro_pagos(hoy-9,hoy,fx.org_a);
  PERFORM pg_temp.assert((SELECT count(*) FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=ant.id::text)=2,
    'AUD100: anticipo y devolución son dos eventos, no alteración de salida');
  SELECT SUM(CASE WHEN p->>'tipo'='devolucion_anticipo' THEN (p->>'monto_mxn')::numeric ELSE -(p->>'monto_mxn')::numeric END)
    INTO neto FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=ant.id::text;
  PERFORM pg_temp.assert(neto=0,'AUD100: salida0.03 más devolución0.03 neto0');
  SELECT p INTO STRICT row_ FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=ant.id::text AND p->>'tipo'='devolucion_anticipo';
  PERFORM pg_temp.assert((row_->>'fecha')::date=hoy-5 AND row_->>'moneda'='MXN'
    AND row_->>'referencia'='Devolución de reserva documental' AND row_->>'cuenta_bancaria_id'=cta::text,
    'AUD100: fecha, referencia y cuenta proceden de devolución bancaria');
  data:=public.pago_detalle('devolucion_anticipo',ant.id);
  PERFORM pg_temp.assert((data->'pago'->>'monto')::numeric=0.03 AND (data->'movimiento'->>'abono')::numeric=0.03
    AND jsonb_array_length(data->'aplicaciones')=0,'AUD100: detalle abre entrada, no salida ni aplicaciones originales');
  PERFORM pg_temp.assert((public.pago_detalle('anticipo',ant.id)->'movimiento'->>'cargo')::numeric=0.03,
    'AUD100: detalle original sigue mostrando su salida bancaria');
  data:=public.libro_pagos(hoy-9,hoy-6,fx.org_a);
  PERFORM pg_temp.assert(jsonb_array_length(data->'pagos')=1 AND data->'pagos'->0->>'tipo'='anticipo',
    'AUD100: devolución fuera del rango no cancela egreso histórico');
  data:=public.libro_pagos(hoy-5,hoy-5,fx.org_a);
  PERFORM pg_temp.assert(jsonb_array_length(data->'pagos')=1 AND data->'pagos'->0->>'tipo'='devolucion_anticipo',
    'AUD100: rango de devolución sólo contiene entrada');
  -- De25 se aplicaron10; se devuelve remanente15. Aplicación es informativa.
  parcial:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>25,p_moneda=>'MXN',
    p_fecha_anticipo=>hoy-9,p_metodo_pago=>'Transferencia',p_cuenta_bancaria_id=>cta);
  aplic:=public.aplicar_anticipo_a_factura(parcial.id,doc,10,hoy-7);
  parcial:=public.devolver_anticipo_proveedor(parcial.id,15,hoy-5,cta,'Remanente','Devolver saldo no aplicado');
  data:=public.libro_pagos(hoy-9,hoy,fx.org_a);
  SELECT SUM(CASE WHEN p->>'tipo'='devolucion_anticipo' THEN (p->>'monto_mxn')::numeric
      WHEN (p->>'es_anticipo_aplicado')::boolean THEN 0 ELSE -(p->>'monto_mxn')::numeric END)
    INTO neto FROM jsonb_array_elements(data->'pagos') p;
  PERFORM pg_temp.assert(neto=-10,'AUD100: bruto25 menos retorno15 deja10 sin duplicar aplicación');
  divisa:=public.registrar_anticipo_proveedor(p_proveedor_id=>prov,p_monto=>2,p_moneda=>'USD',p_tipo_cambio_usd=>20,
    p_fecha_anticipo=>hoy-9,p_metodo_pago=>'Transferencia',p_cuenta_bancaria_id=>usd);
  divisa:=public.devolver_anticipo_proveedor(divisa.id,2,hoy-5,usd,'Retorno USD','Reembolso en misma moneda');
  data:=public.libro_pagos(hoy-5,hoy-5,fx.org_a);
  SELECT p INTO STRICT row_ FROM jsonb_array_elements(data->'pagos') p WHERE p->>'id'=divisa.id::text;
  PERFORM pg_temp.assert(row_->>'moneda'='USD' AND (row_->>'monto')::numeric=2
    AND (row_->>'monto_mxn')::numeric=40 AND row_->>'notas' LIKE '%TC registrado del anticipo original%',
    'AUD100: conservaUSD, TC histórico explícito y equivalenteMXN sin suma nominal');
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.anticipos_proveedor(organization_id,proveedor_id,fecha_anticipo,monto,moneda,estado,saldo_disponible)
    VALUES(fx.org_a,prov,hoy-9,999,'MXN','cancelado',0);
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.libro_pagos(hoy-9,hoy,fx.org_a)->'pagos') p
    WHERE (p->>'monto')::numeric=999),'AUD100: anticipo cancelado no entra en flujo vigente');
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(jsonb_array_length(public.libro_pagos(hoy-9,hoy,fx.org_b)->'pagos')=0,'AUD100: aislamiento multi-tenant');
  PERFORM pg_temp.as_postgres();
END;
$tests$;
ROLLBACK;
