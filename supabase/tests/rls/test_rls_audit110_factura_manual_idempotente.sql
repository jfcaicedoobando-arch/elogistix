-- AUD110. Sólo PostgreSQL efímero; fixtures nuevos y rollback integral.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  ro record;
  cli uuid := gen_random_uuid();
  cli_ro uuid := gen_random_uuid();
  req uuid := gen_random_uuid();
  req_fallo uuid := gen_random_uuid();
  fac uuid;
  replay uuid;
  factura jsonb;
  lineas jsonb;
  err text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD110');
  SELECT * INTO STRICT ro FROM pg_temp.seed_org_pair('AUD110-READONLY', 'customer_service');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (cli, fx.org_a, 'AUD110', 'XAXX010101000', 'aud110@example.invalid'),
    (cli_ro, ro.org_a, 'AUD110-RO', 'XAXX010101000', 'aud110-ro@example.invalid');
  factura := jsonb_build_object('organization_id', fx.org_a, 'cliente_id', cli,
    'cliente_nombre', 'AUD110', 'rfc_cliente', 'XAXX010101000', 'numero', 'BORRADOR-' || req,
    'moneda', 'MXN', 'tipo_cambio', 1, 'subtotal', 100, 'iva', 16, 'total', 116,
    'fecha_emision', CURRENT_DATE, 'fecha_vencimiento', CURRENT_DATE + 30,
    'metodo_pago', 'PPD', 'forma_pago', '99', 'uso_cfdi', 'G03', 'serie', 'A', 'dias_credito', 30);
  lineas := '[{"descripcion":"AUD110 servicio","cantidad":1,"precio_unitario":100,"total":100,"clave_sat":"78101800","tipo_iva":"gravado_16","tasa_iva_aplicada":0.16}]'::jsonb;
  PERFORM pg_temp.assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.crear_factura_manual_idempotente(uuid,jsonb,jsonb)'::regprocedure),
    'AUD110: RPC debe conservar SECURITY INVOKER');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon', 'public.crear_factura_manual_idempotente(uuid,jsonb,jsonb)', 'EXECUTE'),
    'AUD110: anon/PUBLIC no debe ejecutar la nueva RPC');

  PERFORM pg_temp.as_user(fx.admin_a);
  fac := public.crear_factura_manual_idempotente(req, factura, lineas);
  PERFORM pg_temp.assert((SELECT total = 116 AND subtotal = 100 AND iva = 16 AND estado = 'Borrador' AND origen = 'manual'
    FROM public.facturas WHERE id = fac), 'AUD110: alta atómica conserva totales y estado');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.conceptos_factura WHERE factura_id = fac), 'AUD110: crea conceptos');
  replay := public.crear_factura_manual_idempotente(req, factura, lineas);
  PERFORM pg_temp.assert(fac = replay, 'AUD110: replay devuelve la misma factura');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.facturas WHERE numero = factura->>'numero'), 'AUD110: replay no duplica cabecera');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.conceptos_factura WHERE factura_id = fac), 'AUD110: replay no duplica conceptos');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.bitacora_actividad WHERE entidad_id = fac AND accion = 'Creó factura manual borrador'),
    'AUD110: replay no duplica evento de captura');

  err := NULL;
  BEGIN
    PERFORM public.crear_factura_manual_idempotente(req, factura || '{"notas":"otro contenido"}', lineas);
  EXCEPTION WHEN invalid_parameter_value THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(COALESCE(err LIKE 'La captura ya fue enviada con otros datos.%', false), 'AUD110: rechaza identidad reutilizada con otro payload');

  err := NULL;
  BEGIN
    PERFORM public.crear_factura_manual_idempotente(req_fallo,
      factura || jsonb_build_object('numero', 'BORRADOR-' || req_fallo),
      jsonb_set(lineas, '{0,cantidad}', '0'));
  EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(err IS NOT NULL, 'AUD110: línea inválida debe fallar');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.facturas WHERE numero = 'BORRADOR-' || req_fallo),
    'AUD110: una línea inválida no deja borrador huérfano');
  replay := public.crear_factura_manual_idempotente(req_fallo,
    factura || jsonb_build_object('numero', 'BORRADOR-' || req_fallo), lineas);
  PERFORM pg_temp.assert(replay IS NOT NULL AND replay <> fac, 'AUD110: fallo revierte claim; permite reintentar la misma captura');

  PERFORM pg_temp.as_user(fx.admin_b);
  err := NULL;
  BEGIN
    PERFORM public.crear_factura_manual_idempotente(req, factura, lineas);
  EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(err IS NOT NULL, 'AUD110: otro tenant no puede capturar ni recuperar identidad');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.facturas WHERE id = fac), 'AUD110: RLS original oculta factura ajena');

  PERFORM pg_temp.as_user(ro.admin_a);
  err := NULL;
  BEGIN
    PERFORM public.crear_factura_manual_idempotente(gen_random_uuid(), factura || jsonb_build_object(
      'organization_id', ro.org_a, 'cliente_id', cli_ro), lineas);
  EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(err IS NOT NULL, 'AUD110: viewer sigue sin permiso de INSERT por RLS');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.facturas WHERE organization_id = ro.org_a),
    'AUD110: viewer no dejó escritura parcial');
END;
$tests$;
ROLLBACK;
