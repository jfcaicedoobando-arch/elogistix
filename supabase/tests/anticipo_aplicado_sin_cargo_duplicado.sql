-- Auditoría 23: registro/aplicación/regeneración reales, en DB efímera.
-- Un solo cargo original, reintentos idempotentes, edición bloqueada y reverso
-- por su flujo explícito. No se reparan datos históricos.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_orgs record;
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cuenta uuid := gen_random_uuid();
  v_factura uuid := gen_random_uuid();
  v_ant public.anticipos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_parcial public.anticipos_aplicaciones;
  v_precision public.anticipos_aplicaciones;
  v_devolucion public.anticipos_aplicaciones;
  v_pago public.pagos_proveedor;
  v_antes jsonb;
  v_reporte jsonb;
  v_origen uuid;
  v_mov uuid;
  v_legacy uuid;
  v_error text;
  v_cargos numeric;
  v_movimientos integer;
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD23');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_orgs.org_a, 'AUD23 PROVEEDOR', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (v_cat, v_orgs.org_a, 'AUD23 CATEGORIA');
  INSERT INTO public.cuentas_bancarias(
    id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial
  ) VALUES (v_cuenta, v_orgs.org_a, 'AUD23 BANCO', 'MXN', 1000, public.fecha_negocio_mx() - 3);
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, subtotal, total, estado, estado_aprobacion
  ) VALUES (v_factura, v_orgs.org_a, v_prov, v_cat, 'AUD23-' || gen_random_uuid(),
            public.fecha_negocio_mx() - 3, 'MXN', 1000, 1000, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(v_orgs.admin_a);

  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => public.fecha_negocio_mx(), p_metodo_pago => 'Transferencia',
    p_cuenta_bancaria_id => v_cuenta);
  SELECT id INTO STRICT v_origen FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL;
  v_ap := public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 25, public.fecha_negocio_mx());
  PERFORM pg_temp.assert(public._asegurar_movimiento_pago_proveedor(v_ap.pago_proveedor_id)
    IS NOT DISTINCT FROM v_origen, 'AUD23: asegurar debe reutilizar el cargo original');
  FOR v_movimientos IN 1..3 LOOP
    v_mov := public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    PERFORM pg_temp.assert(v_mov IS NOT DISTINCT FROM v_origen, 'AUD23: un reintento cambió el origen');
  END LOOP;
  SELECT count(*), SUM(cargo) INTO v_movimientos, v_cargos FROM public.bbva_movimientos
  WHERE cuenta_bancaria_id = v_cuenta AND deleted_at IS NULL;
  PERFORM pg_temp.assert(v_movimientos = 1 AND v_cargos = 25,
    'AUD23: registrar/aplicar/regenerar debe dejar un cargo25 y saldo975');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.bbva_movimientos
    WHERE pago_proveedor_id = v_ap.pago_proveedor_id AND deleted_at IS NULL),
    'AUD23: una aplicación no debe tener una salida por pago');
  v_reporte := public.conciliar_tesoreria_proveedor(p_factura_id => v_factura);
  PERFORM pg_temp.assert(jsonb_array_length(v_reporte->'incidencias') = 0
    AND (v_reporte->'facturas'->0->>'movimientos')::integer = 1,
    'AUD23: el anticipo válido no debe aparecer como movimiento faltante');

  -- RPC genérica rechazada ANTES de escribir pago o banco.
  SELECT * INTO v_pago FROM public.pagos_proveedor WHERE id = v_ap.pago_proveedor_id;
  v_antes := to_jsonb(v_pago);
  BEGIN
    PERFORM public.actualizar_pago_proveedor_atomico(
      v_pago.id, v_pago.fecha_pago, 20, 'MXN', NULL, 'Transferencia', '', v_cuenta);
    RAISE EXCEPTION 'AUD23: editar aplicación fue permitido';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_PAGO_ANTICIPO_NO_EDITABLE%', 'AUD23: error de edición inesperado');
  END;
  SELECT * INTO v_pago FROM public.pagos_proveedor WHERE id = v_ap.pago_proveedor_id;
  PERFORM pg_temp.assert(to_jsonb(v_pago) = v_antes, 'AUD23: la edición rechazada modificó el pago');
  BEGIN
    UPDATE public.pagos_proveedor SET monto = 20 WHERE id = v_ap.pago_proveedor_id;
    RAISE EXCEPTION 'AUD23: UPDATE directo de aplicación fue permitido';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_PAGO_ANTICIPO_NO_EDITABLE%', 'AUD23: guard directo no protegió edición');
  END;
  BEGIN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, cargo, abono, hash_dedupe, pago_proveedor_id
    ) VALUES (v_orgs.org_a, v_cuenta, public.fecha_negocio_mx(), 25, 0,
              'AUD23-DUP-' || gen_random_uuid(), v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23: INSERT directo generó cargo duplicado';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ANTICIPO_SIN_NUEVO_CARGO%', 'AUD23: guard bancario dio otro error');
  END;

  -- Dos aplicaciones parciales comparten una salida total, no dos cargos.
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => public.fecha_negocio_mx(), p_metodo_pago => 'Transferencia',
    p_cuenta_bancaria_id => v_cuenta);
  SELECT id INTO STRICT v_mov FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL;
  v_parcial := public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 10, public.fecha_negocio_mx());
  PERFORM public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 5, public.fecha_negocio_mx());
  PERFORM pg_temp.assert(public.regenerar_movimiento_pago_proveedor(v_parcial.pago_proveedor_id)
    IS NOT DISTINCT FROM v_mov, 'AUD23: aplicación10 debe reconocer el cargo original25');
  -- El CHECK del pago exige como máximo dos decimales. No cambiarlo
  -- ni tolerar diferencias de vínculo al verificar el origen del anticipo.
  BEGIN
    PERFORM public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 5.123456, public.fecha_negocio_mx());
    RAISE EXCEPTION 'AUD23: se admitió monto fuera de la escala canónica';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE '%pagos_proveedor_monto_escala%', 'AUD23: guard de escala dio otro error');
  END;
  v_precision := public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 5.12, public.fecha_negocio_mx());
  PERFORM pg_temp.assert(v_precision.monto_aplicado = 5.12
    AND public.regenerar_movimiento_pago_proveedor(v_precision.pago_proveedor_id)
      IS NOT DISTINCT FROM v_mov, 'AUD23: precisión persistida creó falsa inconsistencia');
  v_reporte := public.conciliar_tesoreria_proveedor(p_factura_id => v_factura);
  PERFORM pg_temp.assert(jsonb_array_length(v_reporte->'incidencias') = 0
    AND (v_reporte->'facturas'->0->>'movimientos')::integer = 2,
    'AUD23: cuatro aplicaciones deben reconocer dos orígenes bancarios distintos');

  -- Efectivo conserva cero movimientos, también al invocar los helpers.
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => public.fecha_negocio_mx(), p_metodo_pago => 'Efectivo',
    p_cuenta_bancaria_id => v_cuenta);
  v_ant := (SELECT a FROM public.anticipos_proveedor a WHERE a.id = v_ant.id);
  PERFORM pg_temp.assert(v_ant.cuenta_bancaria_id IS NULL, 'AUD23: efectivo no debe conservar cuenta enviada');
  v_pago.id := (public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 25, public.fecha_negocio_mx())).pago_proveedor_id;
  PERFORM pg_temp.assert(public._asegurar_movimiento_pago_proveedor(v_pago.id) IS NULL
    AND public.regenerar_movimiento_pago_proveedor(v_pago.id) IS NULL,
    'AUD23: aplicación de efectivo válida no tiene cargo que regenerar');
  v_reporte := public.conciliar_tesoreria_proveedor(p_factura_id => v_factura);
  PERFORM pg_temp.assert(jsonb_array_length(v_reporte->'incidencias') = 0, 'AUD23: efectivo válido dio falsa incidencia');

  -- Devolver el remanente es compatible con una aplicación parcial viva.
  -- El abono15 no reemplaza ni duplica el cargo original25 del anticipo.
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => public.fecha_negocio_mx(), p_metodo_pago => 'Transferencia',
    p_cuenta_bancaria_id => v_cuenta);
  v_devolucion := public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 10, public.fecha_negocio_mx());
  v_ant := public.devolver_anticipo_proveedor(
    v_ant.id, 15, public.fecha_negocio_mx(), v_cuenta, 'AUD23 DEVOLUCION', 'Remanente de fixture');
  SELECT id INTO STRICT v_pago.id FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL AND cargo > 0;
  PERFORM pg_temp.assert(v_ant.estado = 'devuelto'
    AND public.regenerar_movimiento_pago_proveedor(v_devolucion.pago_proveedor_id)
      IS NOT DISTINCT FROM v_pago.id,
    'AUD23: devolución legítima dio falsa inconsistencia del origen');
  v_reporte := public.conciliar_tesoreria_proveedor(p_factura_id => v_factura);
  PERFORM pg_temp.assert(jsonb_array_length(v_reporte->'incidencias') = 0
    AND (v_reporte->'facturas'->0->>'movimientos')::integer = 3,
    'AUD23: el abono de devolución no debe contarse como otro cargo aplicado');

  -- Datos inconsistentes no se "reparan" creando dinero: el vínculo y el
  -- movimiento original faltante dan una alerta explícita no regenerable.
  PERFORM pg_temp.as_postgres();
  UPDATE public.anticipos_aplicaciones SET monto_aplicado = 24 WHERE id = v_ap.id;
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23: se regeneró una aplicación inconsistente';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ANTICIPO_APLICACION_INCONSISTENTE%', 'AUD23: vínculo inconsistente no identificado');
  END;
  PERFORM pg_temp.as_postgres();
  UPDATE public.anticipos_aplicaciones SET monto_aplicado = 25 WHERE id = v_ap.id;
  UPDATE public.bbva_movimientos SET deleted_at = now() WHERE id = v_origen;
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23: se reemplazó con otro cargo el origen faltante';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE%', 'AUD23: falta de origen no identificada');
  END;
  v_reporte := public.conciliar_tesoreria_proveedor(p_factura_id => v_factura);
  PERFORM pg_temp.assert(jsonb_array_length(v_reporte->'incidencias') = 1
    AND v_reporte->'incidencias'->0->>'tipo' = 'anticipo_inconsistente',
    'AUD23: falta de origen debe pedir revisión sin Regenerar');

  -- Defensa por enlace aun cuando el flag legacy quedó falso.
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, metodo_pago, cuenta_bancaria_id
  ) VALUES (v_orgs.org_a, v_factura, public.fecha_negocio_mx(), 1, 'MXN', 'Transferencia', v_cuenta)
  RETURNING id INTO v_legacy;
  INSERT INTO public.anticipos_aplicaciones(
    organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
    monto_aplicado, moneda_aplicada, fecha_aplicacion
  ) VALUES (v_orgs.org_a, v_parcial.anticipo_id, v_factura, v_legacy, 1, 'MXN', public.fecha_negocio_mx());
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  BEGIN
    PERFORM public.actualizar_pago_proveedor_atomico(v_legacy, public.fecha_negocio_mx(), 4, 'MXN', NULL, 'Transferencia', '', v_cuenta);
    RAISE EXCEPTION 'AUD23: editar aplicación con flag falso fue permitido';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_PAGO_ANTICIPO_NO_EDITABLE%', 'AUD23: no protegió enlace legacy');
  END;
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_legacy);
    RAISE EXCEPTION 'AUD23: regeneración con flag falso fue permitida';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ANTICIPO_APLICACION_INCONSISTENTE%', 'AUD23: no validó flag/link');
  END;

  -- El reverso oficial libera la aplicación y conserva el cargo del anticipo.
  PERFORM public.eliminar_pago_proveedor(v_parcial.pago_proveedor_id, 'AUD23 reverso de fixture');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.anticipos_aplicaciones
    WHERE id = v_parcial.id AND deleted_at IS NOT NULL), 'AUD23: el reverso no liberó la aplicación');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.bbva_movimientos
    WHERE id = v_mov AND deleted_at IS NULL AND cargo = 25), 'AUD23: reverso eliminó la salida original');
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO v_movimientos FROM public.bbva_movimientos WHERE pago_proveedor_id IS NOT NULL
    AND organization_id = v_orgs.org_a AND deleted_at IS NULL;
  PERFORM pg_temp.assert(v_movimientos = 0, 'AUD23: alguna ruta dejó un cargo adicional por aplicación');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD23: cargo único, idempotencia, edición, efectivo, vínculos y reverso protegidos';
END;
$tests$;

ROLLBACK;
