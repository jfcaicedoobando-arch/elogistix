-- AUD65-68: precision sensible, version revisada y moneda de aplicaciones.
-- Solo PostgreSQL efimero. Todos los registros son nuevos y se revierten.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- El error exacto distingue el contrato esperado de un fixture roto.
-- La asercion queda fuera del EXCEPTION para evitar falsos positivos.
CREATE OR REPLACE FUNCTION pg_temp.assert_error(
  p_sql text, p_state text, p_prefix text, p_label text
) RETURNS void LANGUAGE plpgsql AS $helper$
DECLARE
  v_state text;
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(
    COALESCE(v_state = p_state AND v_message LIKE p_prefix || '%', false),
    p_label || ': esperado ' || p_state || '/' || p_prefix || ', obtenido '
      || COALESCE(v_state || '/' || v_message, 'sin error'));
END;
$helper$;

DO $tests$
DECLARE
  fx record;
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cuenta uuid := gen_random_uuid();
  v_f65 uuid := gen_random_uuid();
  v_f66 uuid := gen_random_uuid();
  v_f67 uuid := gen_random_uuid();
  v_f68_usd uuid := gen_random_uuid();
  v_f68_mxn uuid := gen_random_uuid();
  v_f68_nc uuid := gen_random_uuid();
  v_f68_ant uuid := gen_random_uuid();
  v_version_a timestamptz;
  v_version_b timestamptz;
  v_current timestamptz;
  v_invoice public.proveedor_facturas;
  v_saldo jsonb;
  v_pagos jsonb;
  v_ant public.anticipos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_nc uuid;
  v_conceptos jsonb := '[{"descripcion":"Concepto B","cantidad":1,"monto":100,"iva":0,"ieps":0}]';
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD65_68');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, fx.org_a, 'AUD65-68 proveedor', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
  VALUES (v_cat, fx.org_a, 'AUD65-68 administracion', 'Administracion');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (v_cuenta, fx.org_a, 'AUD65-68 banco', 'MXN', 1000, public.fecha_negocio_mx() - 3);

  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, proveedor_nombre, categoria_presupuesto_id,
    folio_proveedor, fecha_emision, moneda, tipo_cambio_usd, subtotal, total,
    estado, estado_aprobacion
  ) VALUES
    (v_f65, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD65', public.fecha_negocio_mx() - 2,
      'USD', 20, 100, 100, 'Vigente', 'pendiente'),
    (v_f66, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD66', public.fecha_negocio_mx() - 2,
      'USD', 20.01, 100, 100, 'Vigente', 'pendiente'),
    (v_f67, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD67', public.fecha_negocio_mx() - 2,
      'MXN', 1, 100, 100, 'Vigente', 'pendiente'),
    (v_f68_usd, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD68-USD', public.fecha_negocio_mx() - 2,
      'USD', 21, 100, 100, 'Vigente', 'aprobada'),
    (v_f68_mxn, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD68-MXN', public.fecha_negocio_mx() - 2,
      'MXN', 21, 1000, 1000, 'Vigente', 'aprobada'),
    (v_f68_nc, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD68-NC', public.fecha_negocio_mx() - 2,
      'USD', 20, 1000, 1000, 'Vigente', 'aprobada'),
    (v_f68_ant, fx.org_a, v_prov, 'AUD65-68 proveedor', v_cat, 'AUD68-ANT', public.fecha_negocio_mx() - 2,
      'MXN', 21, 1000, 1000, 'Vigente', 'aprobada');
  INSERT INTO public.proveedor_facturas_conceptos(
    organization_id, proveedor_factura_id, descripcion, cantidad, monto, iva, ieps
  ) VALUES
    (fx.org_a, v_f65, 'Concepto A', 1, 100, 0, 0),
    (fx.org_a, v_f66, 'Concepto A', 1, 100, 0, 0),
    (fx.org_a, v_f67, 'Concepto A', 1, 100, 0, 0);

  PERFORM pg_temp.as_user(fx.admin_a);

  -- AUD65: cambios de TC a cuatro decimales rompen la aprobacion en servidor.
  SELECT updated_at INTO v_current FROM public.proveedor_facturas WHERE id = v_f65;
  v_invoice := public.aprobar_factura_proveedor(v_f65, true, 'Gasto administrativo de prueba', v_current);
  PERFORM pg_temp.assert(v_invoice.estado_aprobacion = 'aprobada', 'AUD65: control de aprobacion');
  UPDATE public.proveedor_facturas SET notas = 'Nota informativa' WHERE id = v_f65;
  PERFORM pg_temp.assert((SELECT estado_aprobacion = 'aprobada' FROM public.proveedor_facturas WHERE id = v_f65),
    'AUD65: una nota no debe invalidar la aprobacion');
  SELECT updated_at INTO v_version_a FROM public.proveedor_facturas WHERE id = v_f65;
  UPDATE public.proveedor_facturas SET tipo_cambio_usd = 20.0049 WHERE id = v_f65;
  SELECT * INTO v_invoice FROM public.proveedor_facturas WHERE id = v_f65;
  PERFORM pg_temp.assert(v_invoice.tipo_cambio_usd = 20.0049
    AND v_invoice.estado_aprobacion = 'pendiente' AND v_invoice.aprobada_por IS NULL
    AND v_invoice.aprobada_at IS NULL AND v_invoice.updated_at > v_version_a,
    'AUD65: TC20 ->20.0049 debe persistir preciso e invalidar aprobacion/version');
  v_invoice := public.aprobar_factura_proveedor(v_f65, true, 'Gasto administrativo de prueba', v_invoice.updated_at);
  UPDATE public.proveedor_facturas SET tipo_cambio_usd = 20.01 WHERE id = v_f65;
  PERFORM pg_temp.assert((SELECT estado_aprobacion = 'pendiente' FROM public.proveedor_facturas WHERE id = v_f65),
    'AUD65: TC20.01 sigue siendo sensible');
  SELECT updated_at INTO v_current FROM public.proveedor_facturas WHERE id = v_f65;
  v_invoice := public.aprobar_factura_proveedor(v_f65, true, 'Gasto administrativo de prueba', v_current);
  UPDATE public.proveedor_facturas SET subtotal = 100.001 WHERE id = v_f65;
  PERFORM pg_temp.assert((SELECT estado_aprobacion = 'aprobada' FROM public.proveedor_facturas WHERE id = v_f65),
    'AUD65: importes normalizan a dos decimales, no a precision de TC');

  -- AUD66: A revisa20.01, B guarda21. Ninguna decision de A puede procesar21.
  SELECT updated_at INTO v_version_a FROM public.proveedor_facturas WHERE id = v_f66;
  UPDATE public.proveedor_facturas SET tipo_cambio_usd = 21 WHERE id = v_f66;
  SELECT updated_at INTO v_version_b FROM public.proveedor_facturas WHERE id = v_f66;
  PERFORM pg_temp.assert(v_version_b > v_version_a, 'AUD66: version crece dentro de una transaccion');
  UPDATE public.proveedor_facturas SET updated_at = v_version_a, notas = 'B no puede reutilizar token A' WHERE id = v_f66;
  SELECT updated_at INTO v_current FROM public.proveedor_facturas WHERE id = v_f66;
  PERFORM pg_temp.assert(v_current > v_version_b, 'AUD66: timestamp enviado por cliente no reutiliza version');
  v_version_b := v_current;
  PERFORM pg_temp.assert_error(format(
    'SELECT public.aprobar_factura_proveedor(%L::uuid,true,%L,NULL)', v_f66, 'Gasto administrativo de prueba'),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD66: version NULL');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.aprobar_factura_proveedor(%L::uuid,true,%L)', v_f66, 'Gasto administrativo de prueba'),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD66: cliente sin version');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.aprobar_factura_proveedor(%L::uuid,true,%L,%L::timestamptz)',
    v_f66, 'Gasto administrativo de prueba', v_version_a),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD66: aprobacion obsoleta');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.aprobar_factura_proveedor(%L::uuid,false,%L,%L::timestamptz)',
    v_f66, 'Rechazo de prueba', v_version_a),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD66: rechazo obsoleto');
  PERFORM pg_temp.assert((SELECT tipo_cambio_usd = 21 AND estado_aprobacion = 'pendiente'
    AND updated_at = v_version_b AND aprobada_por IS NULL FROM public.proveedor_facturas WHERE id = v_f66),
    'AUD66: conflictos no cambian datos ni estado');
  v_invoice := public.aprobar_factura_proveedor(v_f66, true, 'Gasto administrativo de prueba', v_version_b);
  PERFORM pg_temp.assert(v_invoice.estado_aprobacion = 'aprobada' AND v_invoice.tipo_cambio_usd = 21,
    'AUD66: version recargada permite aprobar lo revisado');

  -- AUD67: cambiar solo descripcion tambien cambia el token de la cabecera.
  SELECT updated_at INTO v_version_a FROM public.proveedor_facturas WHERE id = v_f67;
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_f67, v_conceptos, NULL, v_version_a);
  SELECT updated_at INTO v_version_b FROM public.proveedor_facturas WHERE id = v_f67;
  PERFORM pg_temp.assert(v_version_b > v_version_a
    AND (SELECT subtotal = 100 AND total = 100 FROM public.proveedor_facturas WHERE id = v_f67),
    'AUD67: descripcion cambia version aunque el total sea identico');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.reemplazar_conceptos_factura_proveedor(%L::uuid,%L::jsonb,NULL,NULL)', v_f67, v_conceptos),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD67: conceptos version NULL');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.reemplazar_conceptos_factura_proveedor(%L::uuid,%L::jsonb)', v_f67, v_conceptos),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD67: conceptos cliente sin version');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.reemplazar_conceptos_factura_proveedor(%L::uuid,%L::jsonb,NULL,%L::timestamptz)',
    v_f67, '[{"descripcion":"Concepto A obsoleto","monto":100}]', v_version_a),
    '40001', 'LC_CONFLICTO_CONCURRENCIA', 'AUD67: reemplazo obsoleto');
  PERFORM pg_temp.assert((SELECT count(*) = 1 AND min(descripcion) = 'Concepto B'
    FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = v_f67)
    AND (SELECT updated_at = v_version_b FROM public.proveedor_facturas WHERE id = v_f67),
    'AUD67: rechazo conserva conceptos y token de B');
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_f67,
    '[{"descripcion":"Concepto C","cantidad":2,"monto":50,"iva":0,"ieps":0}]', NULL, v_version_b);
  SELECT updated_at INTO v_version_a FROM public.proveedor_facturas WHERE id = v_f67;
  UPDATE public.proveedor_facturas_conceptos SET descripcion = 'Cambio directo D'
  WHERE proveedor_factura_id = v_f67;
  SELECT updated_at INTO v_version_b FROM public.proveedor_facturas WHERE id = v_f67;
  PERFORM pg_temp.assert(v_version_b > v_version_a, 'AUD67: escritura directa del hijo cambia version padre');
  PERFORM pg_temp.assert_error(format(
    'SELECT public.reemplazar_conceptos_factura_proveedor(%L::uuid,%L::jsonb,NULL,%L::timestamptz)',
    v_f67, v_conceptos, v_version_a), '40001', 'LC_CONFLICTO_CONCURRENCIA',
    'AUD67: cambio directo tampoco se sobrescribe');
  UPDATE public.proveedor_facturas_conceptos SET descripcion = 'Descripcion revisable'
  WHERE proveedor_factura_id = v_f66;
  PERFORM pg_temp.assert((SELECT estado_aprobacion = 'pendiente' AND aprobada_por IS NULL
    FROM public.proveedor_facturas WHERE id = v_f66), 'AUD67: editar conceptos invalida aprobacion');

  -- AUD68: se bloquea cambiar unidad, conservando el aplicado historico.
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd)
  VALUES (fx.org_a, v_f68_usd, public.fecha_negocio_mx(), 1, 'USD', 21);
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''MXN'' WHERE id=%L::uuid', v_f68_usd),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: pago USD1@21');
  v_saldo := public.saldo_factura_proveedor(v_f68_usd);
  PERFORM pg_temp.assert(v_saldo->>'moneda' = 'USD' AND (v_saldo->>'pagado')::numeric = 1
    AND (v_saldo->>'saldo')::numeric = 99
    AND (SELECT monto_en_moneda_factura = 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = v_f68_usd),
    'AUD68: intento rechazado conservaUSD100, aplicadoUSD1 y saldoUSD99');
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd)
  VALUES (fx.org_a, v_f68_usd, public.fecha_negocio_mx(), 42, 'MXN', 21),
    (fx.org_a, v_f68_usd, public.fecha_negocio_mx(), 3, 'USD', 21);
  SELECT jsonb_agg(jsonb_build_array(id, monto, moneda, tipo_cambio_usd, monto_en_moneda_factura) ORDER BY id)
    INTO v_pagos FROM public.pagos_proveedor WHERE proveedor_factura_id = v_f68_usd;
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''MXN'' WHERE id=%L::uuid', v_f68_usd),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: multipago USD/MXN');
  v_saldo := public.saldo_factura_proveedor(v_f68_usd);
  PERFORM pg_temp.assert((v_saldo->>'pagado')::numeric = 6 AND (v_saldo->>'saldo')::numeric = 94
    AND v_pagos = (SELECT jsonb_agg(jsonb_build_array(id, monto, moneda, tipo_cambio_usd, monto_en_moneda_factura) ORDER BY id)
      FROM public.pagos_proveedor WHERE proveedor_factura_id = v_f68_usd),
    'AUD68: multipago permanece exacto y sin reconversion silenciosa');
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd)
  VALUES (fx.org_a, v_f68_mxn, public.fecha_negocio_mx(), 1, 'USD', 21),
    (fx.org_a, v_f68_mxn, public.fecha_negocio_mx(), 1, 'MXN', 21);
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''USD'' WHERE id=%L::uuid', v_f68_mxn),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: cruce inverso MXN/USD');
  v_saldo := public.saldo_factura_proveedor(v_f68_mxn);
  PERFORM pg_temp.assert((v_saldo->>'pagado')::numeric = 22 AND (v_saldo->>'saldo')::numeric = 978,
    'AUD68: factura MXN conserva aplicado21+1');

  -- Eliminar una de varias aplicaciones no habilita cambiar moneda.
  PERFORM public.eliminar_pago_proveedor((SELECT id FROM public.pagos_proveedor
    WHERE proveedor_factura_id = v_f68_mxn AND moneda = 'USD'), 'AUD68 rollback fixture');
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''USD'' WHERE id=%L::uuid', v_f68_mxn),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: aun queda un pago activo');
  PERFORM public.eliminar_pago_proveedor((SELECT id FROM public.pagos_proveedor
    WHERE proveedor_factura_id = v_f68_mxn AND deleted_at IS NULL), 'AUD68 rollback fixture');
  UPDATE public.proveedor_facturas SET moneda = 'USD' WHERE id = v_f68_mxn;
  PERFORM pg_temp.assert((SELECT moneda = 'USD' FROM public.proveedor_facturas WHERE id = v_f68_mxn),
    'AUD68: pagos eliminados permiten corregir moneda');
  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, monto, moneda, estado
  ) VALUES (fx.org_a, v_f68_mxn, public.fecha_negocio_mx(), 1, 'USD', 'Borrador');
  UPDATE public.proveedor_facturas SET moneda = 'MXN' WHERE id = v_f68_mxn;
  PERFORM pg_temp.assert((SELECT moneda = 'MXN' FROM public.proveedor_facturas WHERE id = v_f68_mxn),
    'AUD68: NC no aplicada no impide corregir moneda');

  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio, estado
  ) VALUES (fx.org_a, v_f68_nc, public.fecha_negocio_mx(), 20, 'MXN', 20, 'Borrador') RETURNING id INTO v_nc;
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = v_nc;
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = v_nc;
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''MXN'' WHERE id=%L::uuid', v_f68_nc),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: NC aplicada otra moneda');
  v_saldo := public.saldo_factura_proveedor(v_f68_nc);
  PERFORM pg_temp.assert((v_saldo->>'nc_aplicada')::numeric = 1 AND (v_saldo->>'saldo')::numeric = 999,
    'AUD68: bloqueo conserva NC20MXN@20=USD1');
  UPDATE public.proveedor_notas_credito SET deleted_at = now() WHERE id = v_nc;
  UPDATE public.proveedor_facturas SET moneda = 'MXN' WHERE id = v_f68_nc;
  PERFORM pg_temp.assert((SELECT moneda = 'MXN' FROM public.proveedor_facturas WHERE id = v_f68_nc),
    'AUD68: NC eliminada libera cambio moneda');

  v_ant := public.registrar_anticipo_proveedor(p_proveedor_id => v_prov, p_monto => 25,
    p_moneda => 'MXN', p_fecha_anticipo => public.fecha_negocio_mx(),
    p_metodo_pago => 'Transferencia', p_cuenta_bancaria_id => v_cuenta);
  v_ap := public.aplicar_anticipo_a_factura(v_ant.id, v_f68_ant, 25, public.fecha_negocio_mx());
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''USD'' WHERE id=%L::uuid', v_f68_ant),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: anticipo aplicado');
  -- Estado historico inconsistente sintetico: aplicacion viva con pago en papelera.
  -- Comprueba la defensa por el enlace, sin omitir triggers ni reparar registros reales.
  PERFORM pg_temp.as_postgres();
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = v_ap.pago_proveedor_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert_error(format('UPDATE public.proveedor_facturas SET moneda=''USD'' WHERE id=%L::uuid', v_f68_ant),
    '23514', 'LC_CXP_MONEDA_CON_APLICACIONES', 'AUD68: aplicacion viva aunque pago eliminado');
  PERFORM pg_temp.as_postgres();
  UPDATE public.pagos_proveedor SET deleted_at = NULL WHERE id = v_ap.pago_proveedor_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM public.eliminar_pago_proveedor(v_ap.pago_proveedor_id, 'AUD68 reverso fixture');
  PERFORM pg_temp.assert((SELECT deleted_at IS NOT NULL FROM public.anticipos_aplicaciones WHERE id = v_ap.id),
    'AUD68: reverso oficial elimina la aplicacion');
  UPDATE public.proveedor_facturas SET moneda = 'USD' WHERE id = v_f68_ant;
  PERFORM pg_temp.assert((SELECT moneda = 'USD' FROM public.proveedor_facturas WHERE id = v_f68_ant),
    'AUD68: anticipo revertido permite cambiar moneda');

  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(to_regprocedure('public.aprobar_factura_proveedor(uuid,boolean,text)') IS NULL
    AND to_regprocedure('public.reemplazar_conceptos_factura_proveedor(uuid,jsonb,jsonb)') IS NULL,
    'AUD66-67: no deben sobrevivir sobrecargas que eludan version revisada');
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated', 'public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.reemplazar_conceptos_factura_proveedor(uuid,jsonb,jsonb,timestamp with time zone)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.reemplazar_conceptos_factura_proveedor(uuid,jsonb,jsonb,timestamp with time zone)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.reemplazar_conceptos_factura_proveedor(uuid,jsonb,jsonb,timestamp with time zone)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.reemplazar_conceptos_factura_proveedor(uuid,jsonb,jsonb,timestamp with time zone)', 'EXECUTE'),
    'AUD66-67: grants de firmas nuevas conservan acceso autenticado privado');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD65-68: precision, CAS, hijos directos y aplicaciones multimoneda verificados';
END;
$tests$;
ROLLBACK;
