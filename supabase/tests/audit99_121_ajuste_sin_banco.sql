-- AUD99/121: contrato de escritura. Sólo datos sintéticos y rollback.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.expect_noncash_error(p_sql text, p_error text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE err text;
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(err IS NOT NULL AND err LIKE p_error || '%',
    'AUD99121B esperaba ' || p_error || ', recibió ' || COALESCE(err, 'ningún error'));
END;
$$;
DO $tests$
DECLARE
  fx record; prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); cuenta uuid := gen_random_uuid();
  fac uuid := gen_random_uuid(); fac_normal uuid := gen_random_uuid(); ajuste uuid; pago uuid; mov uuid;
  lote uuid := gen_random_uuid();
  vendedor uuid := gen_random_uuid(); antes jsonb; pago_antes jsonb; historial_antes jsonb; n int;
  hoy date := public.fecha_negocio_mx(); r text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD99121B', 'tesorero');
  PERFORM pg_temp.seed_auth_user(vendedor);
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES(fx.org_a, vendedor, 'vendedor');
  INSERT INTO public.user_roles(user_id, role) VALUES(vendedor, 'vendedor')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES(prov, fx.org_a, 'AUD99121B', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES(cat, fx.org_a, 'AUD99121B');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
    VALUES(cuenta, fx.org_a, 'AUD99121B MXN', 'MXN', 10, hoy - 30);
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES(fac, fx.org_a, prov, cat, 'AUD99121B-AJUSTE', hoy - 1, 'MXN', 1, 1, 1, 'Vigente', 'aprobada'),
          (fac_normal, fx.org_a, prov, cat, 'AUD99121B-PAGO', hoy - 1, 'MXN', 1, 100, 100, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  ajuste := public.cerrar_factura_proveedor_sin_pago(fac, 'condonacion', 'Fixture aislado');
  SELECT to_jsonb(p) INTO pago_antes FROM public.pagos_proveedor p WHERE id = ajuste;
  SELECT jsonb_agg(to_jsonb(b) ORDER BY id) INTO historial_antes FROM public.bitacora_actividad b WHERE entidad_id = fac;

  -- INSERT directo, también si intenta nacer en papelera: no crea nueva asociación.
  PERFORM pg_temp.expect_noncash_error(format($q$INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono, hash_dedupe, pago_proveedor_id)
    VALUES(%L, %L, %L, 'AUD99121B', 1, 0, 'AUD99121B-INSERT', %L)$q$, fx.org_a, cuenta, hoy, ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.expect_noncash_error(format($q$INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono, hash_dedupe, pago_proveedor_id, deleted_at)
    VALUES(%L, %L, %L, 'AUD99121B', 1, 0, 'AUD99121B-PAPELERA', %L, now())$q$, fx.org_a, cuenta, hoy, ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  INSERT INTO public.bbva_movimientos(organization_id, cuenta_bancaria_id, fecha, concepto, cargo, abono, hash_dedupe)
    VALUES(fx.org_a, cuenta, hoy, 'AUD99121B pendiente', 1, 0, 'AUD99121B-UPDATE') RETURNING id INTO mov;
  SELECT to_jsonb(m) INTO antes FROM public.bbva_movimientos m WHERE id = mov;
  PERFORM pg_temp.expect_noncash_error(format($q$UPDATE public.bbva_movimientos SET pago_proveedor_id = %L,
    estado_conciliacion = 'Conciliado', conciliado_por = %L, conciliado_at = now() WHERE id = %L$q$, ajuste, fx.admin_a, mov),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.assert((SELECT to_jsonb(m) = antes FROM public.bbva_movimientos m WHERE id = mov),
    'AUD99121B: UPDATE rechazado conserva vínculo, actor, estado y todos los campos');

  -- El texto libre Ajuste no convierte un pago ordinario en un ajuste.
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
    metodo_pago, referencia, es_ajuste)
    VALUES(fx.org_a, fac_normal, hoy, 1, 'MXN', 1, 'Ajuste', 'Cierre sin pago: condonacion', false) RETURNING id INTO pago;
  UPDATE public.bbva_movimientos SET pago_proveedor_id = pago, estado_conciliacion = 'Conciliado',
    conciliado_por = fx.admin_a, conciliado_at = now() WHERE id = mov;
  SELECT to_jsonb(m) INTO antes FROM public.bbva_movimientos m WHERE id = mov;
  PERFORM pg_temp.assert(antes->>'pago_proveedor_id' = pago::text AND antes->>'estado_conciliacion' = 'Conciliado',
    'AUD99121B: pago ordinario vincula con rol tesorero y monto/moneda idénticos');
  PERFORM pg_temp.expect_noncash_error(format('UPDATE public.bbva_movimientos SET pago_proveedor_id = %L WHERE id = %L', ajuste, mov),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.assert((SELECT to_jsonb(m) = antes FROM public.bbva_movimientos m WHERE id = mov),
    'AUD99121B: retarget rechazado conserva movimiento completo');

  -- Los ajustes tampoco ingresan indirectamente por un lote monetario.
  INSERT INTO public.pagos_proveedor_lote(id, organization_id, proveedor_id, fecha_pago, moneda, monto_total, cuenta_bancaria_id)
    VALUES(lote, fx.org_a, prov, hoy, 'MXN', 1, cuenta);
  PERFORM pg_temp.expect_noncash_error(format('UPDATE public.pagos_proveedor SET lote_id = %L WHERE id = %L', lote, ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.expect_noncash_error(format($q$INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda, es_ajuste, lote_id)
    VALUES(%L,%L,%L,1,'MXN',true,%L)$q$, fx.org_a, fac_normal, hoy, lote), 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  UPDATE public.pagos_proveedor SET lote_id = lote WHERE id = pago;
  PERFORM pg_temp.assert((SELECT lote_id = lote FROM public.pagos_proveedor WHERE id = pago),
    'AUD99121B: pago ordinario sí puede agruparse');
  UPDATE public.pagos_proveedor SET lote_id = NULL WHERE id = pago;

  -- Cambiar el flag está prohibido en ambos sentidos, vinculado o no, incluso en papelera.
  PERFORM pg_temp.expect_noncash_error(format('UPDATE public.pagos_proveedor SET es_ajuste = true WHERE id = %L', pago),
    'LC_PAGO_CLASIFICACION_INMUTABLE:');
  PERFORM pg_temp.expect_noncash_error(format('UPDATE public.pagos_proveedor SET es_ajuste = false WHERE id = %L', ajuste),
    'LC_PAGO_CLASIFICACION_INMUTABLE:');
  UPDATE public.pagos_proveedor SET es_ajuste = true WHERE id = ajuste;
  PERFORM pg_temp.assert((SELECT es_ajuste AND monto = 1 FROM public.pagos_proveedor WHERE id = ajuste),
    'AUD99121B: reescribir mismo flag permitido');

  -- Otro tenant y un rol sin tesorería siguen bloqueados ANTES del error de dominio RPC.
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.expect_noncash_error(format('SELECT public._asegurar_movimiento_pago_proveedor(%L)', ajuste),
    'LC_MOVIMIENTO_PAGO_INEXISTENTE:');
  PERFORM pg_temp.expect_noncash_error(format('SELECT public.regenerar_movimiento_pago_proveedor(%L)', ajuste), 'LC_ORG_MISMATCH:');
  UPDATE public.bbva_movimientos SET pago_proveedor_id = ajuste WHERE id = mov;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.assert(n = 0, 'AUD99121B: otro tenant no modifica movimiento');
  PERFORM pg_temp.as_user(vendedor);
  PERFORM pg_temp.expect_noncash_error(format('SELECT public.regenerar_movimiento_pago_proveedor(%L)', ajuste), 'LC_MOVIMIENTO_SIN_PERMISO:');
  UPDATE public.bbva_movimientos SET pago_proveedor_id = ajuste WHERE id = mov;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.assert(n = 0, 'AUD99121B: vendedor no modifica movimiento');
  PERFORM pg_temp.as_user(fx.admin_a);

  -- Helper falla antes de consultar/reutilizar banco, con o sin cuenta configurada.
  PERFORM pg_temp.expect_noncash_error(format('SELECT public._asegurar_movimiento_pago_proveedor(%L)', ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.expect_noncash_error(format('SELECT public.regenerar_movimiento_pago_proveedor(%L)', ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  UPDATE public.pagos_proveedor SET cuenta_bancaria_id = cuenta WHERE id = ajuste;
  PERFORM pg_temp.expect_noncash_error(format('SELECT public._asegurar_movimiento_pago_proveedor(%L)', ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.expect_noncash_error(format('SELECT public.regenerar_movimiento_pago_proveedor(%L)', ajuste),
    'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE pago_proveedor_id = ajuste),
    'AUD99121B: ningún rechazo deja asociación parcial');
  PERFORM pg_temp.assert((SELECT jsonb_agg(to_jsonb(b) ORDER BY id) = historial_antes
    FROM public.bitacora_actividad b WHERE entidad_id = fac), 'AUD99121B: rechazos no escriben bitácora de éxito');

  -- Regeneración ordinaria, idempotente, y desvínculo ordinario permanecen posibles.
  UPDATE public.pagos_proveedor SET cuenta_bancaria_id = cuenta WHERE id = pago;
  PERFORM pg_temp.assert(public.regenerar_movimiento_pago_proveedor(pago) = mov,
    'AUD99121B: reutiliza vínculo ordinario');
  UPDATE public.bbva_movimientos SET pago_proveedor_id = NULL, estado_conciliacion = 'Pendiente' WHERE id = mov;
  PERFORM pg_temp.assert(public.regenerar_movimiento_pago_proveedor(pago) IS NOT NULL,
    'AUD99121B: genera nuevo movimiento ordinario');
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = ajuste;
  PERFORM pg_temp.expect_noncash_error(format('UPDATE public.pagos_proveedor SET es_ajuste = false WHERE id = %L', ajuste),
    'LC_PAGO_CLASIFICACION_INMUTABLE:');
  PERFORM pg_temp.as_postgres();
  FOREACH r IN ARRAY ARRAY['assert_movimiento_pago_consistente()', '_asegurar_movimiento_pago_proveedor(uuid)',
    'regenerar_movimiento_pago_proveedor(uuid)', '_guard_pago_clasificacion()', '_guard_movimiento_ajuste_activacion()'] LOOP
    PERFORM pg_temp.assert(NOT has_function_privilege('anon', 'public.' || r, 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.' || r, 'EXECUTE')
      AND has_function_privilege('service_role', 'public.' || r, 'EXECUTE'), 'AUD99121B: ACL ' || r);
  END LOOP;
  PERFORM pg_temp.assert((SELECT NOT prosecdef FROM pg_proc WHERE oid = 'public._asegurar_movimiento_pago_proveedor(uuid)'::regprocedure),
    'AUD99121B: helper sigue SECURITY INVOKER bajo RLS');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'PASS AUD99/121 banco: INSERT, UPDATE, retarget, flag inmutable, generación, roles y otro tenant';
END;
$tests$;
ROLLBACK;
