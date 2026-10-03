-- Auditoría 23: permisos y tenant del origen bancario de una aplicación.
-- Usa los roles reales de la fixture CI, sin bypass de RLS para las llamadas.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_orgs record;
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cuenta uuid := gen_random_uuid();
  v_factura uuid := gen_random_uuid();
  v_lector uuid := gen_random_uuid();
  v_sin_org uuid := gen_random_uuid();
  v_ant public.anticipos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_origen uuid;
  v_error text;
  v_cantidad integer;
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD23RLS');
  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_orgs.org_a, v_lector, 'customer_service');
  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_lector, 'customer_service'), (v_sin_org, 'tesorero')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_orgs.org_a, 'AUD23RLS proveedor', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (v_cat, v_orgs.org_a, 'AUD23RLS categoría');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (v_cuenta, v_orgs.org_a, 'AUD23RLS banco', 'MXN', 1000, public.fecha_negocio_mx() - 3);
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, subtotal, total, estado, estado_aprobacion
  ) VALUES (v_factura, v_orgs.org_a, v_prov, v_cat, 'AUD23RLS-' || gen_random_uuid(),
            public.fecha_negocio_mx() - 3, 'MXN', 100, 100, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => public.fecha_negocio_mx(), p_metodo_pago => 'Transferencia',
    p_cuenta_bancaria_id => v_cuenta);
  v_ap := public.aplicar_anticipo_a_factura(v_ant.id, v_factura, 25, public.fecha_negocio_mx());
  SELECT id INTO STRICT v_origen FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL;
  PERFORM pg_temp.assert(public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id) = v_origen,
    'AUD23RLS: administrador propio debe verificar el origen');

  PERFORM pg_temp.as_user(v_orgs.admin_b);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_proveedor WHERE id = v_ap.pago_proveedor_id),
    'AUD23RLS: otro tenant puede leer el pago');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.bbva_movimientos WHERE id = v_origen),
    'AUD23RLS: otro tenant puede leer el cargo original');
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23RLS: otro tenant pudo regenerar';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ORG_MISMATCH%', 'AUD23RLS: fallo cruzado inesperado');
  END;
  -- El helper es invoker: no puede revelar un UUID bancario de otro tenant.
  BEGIN
    PERFORM public._movimiento_original_anticipo_aplicado(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23RLS: helper reveló el origen de otro tenant';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ANTICIPO_APLICACION_INCONSISTENTE%',
      'AUD23RLS: helper cruzado no quedó bajo RLS');
  END;

  PERFORM pg_temp.as_user(v_sin_org);
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23RLS: sesión sin organización pudo regenerar';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_SIN_ORG%', 'AUD23RLS: sesión sin org dio otro error');
  END;

  PERFORM pg_temp.as_user(v_lector);
  BEGIN
    PERFORM public.regenerar_movimiento_pago_proveedor(v_ap.pago_proveedor_id);
    RAISE EXCEPTION 'AUD23RLS: usuario sin permiso financiero pudo regenerar';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_MOVIMIENTO_SIN_PERMISO%', 'AUD23RLS: lector dio otro error');
  END;

  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO v_cantidad FROM public.bbva_movimientos
  WHERE organization_id = v_orgs.org_a AND deleted_at IS NULL;
  PERFORM pg_temp.assert(v_cantidad = 1 AND EXISTS (SELECT 1 FROM public.bbva_movimientos
    WHERE id = v_origen AND cargo = 25 AND pago_proveedor_id IS NULL AND deleted_at IS NULL),
    'AUD23RLS: las llamadas rechazadas cambiaron banco u origen');
  PERFORM pg_temp.assert(NOT has_function_privilege('authenticated',
    'public._guard_movimiento_anticipo_aplicado()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated',
    'public._guard_pago_anticipo_aplicado_edicion()', 'EXECUTE'),
    'AUD23RLS: las funciones de trigger internas quedaron públicas');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD23RLS: tenant, sesión sin org, rol financiero y ACL privados verificados';
END;
$tests$;
ROLLBACK;
