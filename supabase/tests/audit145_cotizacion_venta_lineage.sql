-- Audit145: additive lineage, atomic replacement, replay and authorization.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cot uuid := gen_random_uuid();
  origen uuid := 'a1450000-abcd-4abc-8abc-000000000001';
  request_id uuid := gen_random_uuid();
  sello timestamptz;
  row_id uuid;
  res jsonb;
  repetida jsonb;
  payload jsonb;
  original_ventas jsonb := '[{"descripcion":"Manual MXN","cantidad":1,"precio_unitario":10200,"moneda":"MXN","total":10200,"tipo_iva":"no_objeto","aplica_iva":false,"tasa_iva_aplicada":0}]';
  rejected boolean;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD145');
  INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,estado,subtotal,conceptos_venta)
    VALUES(cot,fx.org_a,'AUD145-COT','Marítimo','Importación','Borrador',10200,original_ventas)
    RETURNING updated_at INTO sello;
  payload := jsonb_build_array(jsonb_build_object('concepto','Flete','moneda','USD','proveedor','Naviera',
    'cantidad',1,'costo_unitario',1,'precio_venta',100,'origen_venta_id',origen));
  PERFORM pg_temp.as_user(fx.admin_a);
  res := public.actualizar_cotizacion_costos(cot,payload,request_id,sello);
  SELECT id INTO STRICT row_id FROM public.cotizacion_costos WHERE cotizacion_id=cot;
  PERFORM pg_temp.assert((SELECT origen_venta_id=origen FROM public.cotizacion_costos WHERE id=row_id),
    'AUD145 stores source identity');
  repetida := public.actualizar_cotizacion_costos(cot,payload,request_id,sello);
  PERFORM pg_temp.assert(repetida=res AND (SELECT id=row_id FROM public.cotizacion_costos WHERE cotizacion_id=cot),
    'AUD145 idempotent replay neither replaces rows nor duplicates identity');

  payload := jsonb_set(payload,'{0,precio_venta}','2');
  res := public.actualizar_cotizacion_costos(cot,payload,NULL,(res->>'updated_at')::timestamptz);
  PERFORM pg_temp.assert((SELECT origen_venta_id=origen AND precio_venta=2 FROM public.cotizacion_costos WHERE cotizacion_id=cot),
    'AUD145 source identity survives row replacement and price editing');
  SELECT id INTO STRICT row_id FROM public.cotizacion_costos WHERE cotizacion_id=cot;
  rejected := false;
  BEGIN
    PERFORM public.actualizar_cotizacion_costos(cot,payload||jsonb_set(payload,'{0,origen_venta_id}',to_jsonb(upper(origen::text))),NULL,(res->>'updated_at')::timestamptz);
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected := SQLERRM LIKE '%LC_COT_ORIGEN_VENTA_DUPLICADO%';
  END;
  PERFORM pg_temp.assert(rejected,'AUD145 duplicate normalized UUID rejected');
  PERFORM pg_temp.assert((SELECT id=row_id FROM public.cotizacion_costos WHERE cotizacion_id=cot),
    'AUD145 duplicate rejection preserves exact previous row');

  rejected := false;
  BEGIN
    PERFORM public.actualizar_cotizacion_costos(cot,payload,NULL,(res->>'updated_at')::timestamptz-interval '1 day');
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM LIKE '%LC_CONFLICTO_CONCURRENCIA%';
  END;
  PERFORM pg_temp.assert(rejected,'AUD145 stale snapshot rejected before replacement');
  rejected := false;
  BEGIN
    PERFORM public.actualizar_cotizacion_costos(cot,payload||jsonb_build_array(jsonb_build_object(
      'concepto','Invalid second row','moneda','USD','cantidad','not-a-number')),
      NULL,(res->>'updated_at')::timestamptz);
  EXCEPTION WHEN invalid_text_representation THEN rejected := true;
  END;
  PERFORM pg_temp.assert(rejected AND (SELECT id=row_id FROM public.cotizacion_costos WHERE cotizacion_id=cot),
    'AUD145 failure after delete/first insert rolls back complete replacement');
  PERFORM pg_temp.assert((SELECT conceptos_venta=original_ventas AND subtotal=10200 FROM public.cotizaciones WHERE id=cot),
    'AUD145 cost writes preserve manual sales and explicit non-taxable treatment');

  PERFORM pg_temp.as_user(fx.admin_b);
  rejected := false;
  BEGIN
    PERFORM public.actualizar_cotizacion_costos(cot,payload,request_id,sello);
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  PERFORM pg_temp.assert(rejected,'AUD145 cross-tenant replay rejected before idempotency');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT has_function_privilege('anon','public.actualizar_cotizacion_costos(uuid,jsonb,uuid,timestamptz)','EXECUTE'),
    'AUD145 anon cannot execute replacement');
  PERFORM pg_temp.assert(has_function_privilege('authenticated','public.actualizar_cotizacion_costos(uuid,jsonb,uuid,timestamptz)','EXECUTE'),
    'AUD145 existing authenticated entrypoint remains available');
END;
$tests$;
ROLLBACK;
