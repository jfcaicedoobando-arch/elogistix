-- AUD99/121: sólo fixtures aislados y rollback. La lectura no altera el histórico.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record; prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); fac uuid; pay uuid;
  motivo text; hoy date := public.fecha_negocio_mx(); evento record; err text;
  pago_antes jsonb; factura_antes jsonb; bitacora_antes jsonb;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD99121H');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (prov, fx.org_a, 'AUD99121H proveedor', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES (cat, fx.org_a, 'AUD99121H');
  FOREACH motivo IN ARRAY ARRAY['compensacion', 'condonacion', 'ajuste_historico', 'duplicada'] LOOP
    PERFORM pg_temp.as_postgres(); fac := gen_random_uuid();
    INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
      fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
      VALUES (fac, fx.org_a, prov, cat, 'AUD99121H-' || motivo, hoy - 1, 'MXN', 1, 1, 1, 'Vigente', 'aprobada');
    PERFORM pg_temp.as_user(fx.admin_a);
    pay := public.cerrar_factura_proveedor_sin_pago(fac, motivo, 'Fixture local');
    SELECT to_jsonb(p) INTO pago_antes FROM public.pagos_proveedor p WHERE id = pay;
    SELECT to_jsonb(f) INTO factura_antes FROM public.proveedor_facturas f WHERE id = fac;
    SELECT jsonb_agg(to_jsonb(b) ORDER BY id) INTO bitacora_antes FROM public.bitacora_actividad b WHERE entidad_id = fac;
    SELECT * INTO STRICT evento FROM public.historial_proveedor_factura(fac) WHERE detalles->>'pago_id' = pay::text;
    PERFORM pg_temp.assert(evento.tipo = 'pago' AND evento.descripcion = 'Ajuste no monetario registrado · ref Cierre sin pago: ' || motivo
      AND evento.detalles->'es_ajuste' = 'true'::jsonb AND evento.detalles->>'motivo_ajuste' = motivo,
      'AUD99121H: tipo compatible y clasificación desde flag/motivo reales');
    PERFORM pg_temp.assert(evento.monto = 1 AND evento.moneda = 'MXN'
      AND evento.detalles->>'fecha_pago' = hoy::text AND evento.ts = (pago_antes->>'created_at')::timestamptz,
      'AUD99121H: importe, moneda y fechas intactos');
    PERFORM pg_temp.assert((SELECT to_jsonb(p) = pago_antes FROM public.pagos_proveedor p WHERE id = pay)
      AND (SELECT to_jsonb(f) = factura_antes FROM public.proveedor_facturas f WHERE id = fac)
      AND (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) = bitacora_antes FROM public.bitacora_actividad b WHERE entidad_id = fac),
      'AUD99121H: leer historial no altera pagos, factura ni bitácora');
    PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.bbva_movimientos WHERE pago_proveedor_id = pay),
      'AUD99121H: no crea movimiento bancario');

    PERFORM pg_temp.as_postgres();
    UPDATE public.pagos_proveedor SET referencia = '', metodo_pago = '03' WHERE id = pay;
    PERFORM pg_temp.as_user(fx.admin_a);
    SELECT * INTO STRICT evento FROM public.historial_proveedor_factura(fac) WHERE detalles->>'pago_id' = pay::text;
    PERFORM pg_temp.assert(evento.descripcion = 'Ajuste no monetario registrado'
      AND evento.detalles->'es_ajuste' = 'true'::jsonb, 'AUD99121H: ajuste sin referencia ni método reconocible');
    PERFORM pg_temp.as_user(fx.admin_b); err := NULL;
    BEGIN PERFORM public.historial_proveedor_factura(fac);
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT; END;
    PERFORM pg_temp.assert(err IS NOT DISTINCT FROM 'Sin acceso a la factura', 'AUD99121H: bloquea otro tenant');
    PERFORM pg_temp.as_postgres();
    UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = pay;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.historial_proveedor_factura(fac)
      WHERE detalles->>'pago_id' = pay::text), 'AUD99121H: ajuste en papelera no se presenta vigente');
  END LOOP;

  -- Texto libre que menciona ajuste no promueve un pago ordinario a ajuste.
  PERFORM pg_temp.as_postgres(); fac := gen_random_uuid();
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES (fac, fx.org_a, prov, cat, 'AUD99121H-ORDINARIO', hoy - 1, 'MXN', 1, 2, 2, 'Vigente', 'aprobada');
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
    tipo_cambio_usd, metodo_pago, referencia, es_ajuste)
    VALUES (fx.org_a, fac, hoy, 1, 'MXN', 1, 'Ajuste', 'Cierre sin pago: condonacion', false) RETURNING id INTO pay;
  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO STRICT evento FROM public.historial_proveedor_factura(fac) WHERE detalles->>'pago_id' = pay::text;
  PERFORM pg_temp.assert(evento.tipo = 'pago' AND evento.descripcion = 'Pago registrado · ref Cierre sin pago: condonacion'
    AND evento.detalles->'es_ajuste' = 'false'::jsonb AND evento.detalles->'motivo_ajuste' = 'null'::jsonb
    AND evento.monto = 1 AND evento.moneda = 'MXN', 'AUD99121H: pago ordinario permanece pago sin inferencia textual');
  PERFORM pg_temp.as_postgres();
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = pay;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.historial_proveedor_factura(fac)
    WHERE detalles->>'pago_id' = pay::text), 'AUD99121H: pago en papelera no se presenta vigente');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT has_function_privilege('anon', 'public.historial_proveedor_factura(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.historial_proveedor_factura(uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.historial_proveedor_factura(uuid)', 'EXECUTE'), 'AUD99121H: ACL intacta');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'PASS AUD99/121 historial: ajustes tipificados, pagos, motivos, baja lógica, aislamiento y datos intactos';
END;
$tests$;
ROLLBACK;
