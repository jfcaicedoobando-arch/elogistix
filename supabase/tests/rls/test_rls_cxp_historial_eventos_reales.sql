-- AUD-57: historial sólo para miembros de la organización o super_admin.
-- Cada invocación usa el rol real; datos de prueba aislados con rollback.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  v_pf uuid := gen_random_uuid();
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_super uuid := gen_random_uuid();
  v_sin_org uuid := gen_random_uuid();
  v_error text;
  v_evento record;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD57RLS');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_super, 'super_admin'), (v_sin_org, 'contador');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
    VALUES (v_prov, fx.org_a, 'AUD57RLS proveedor', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
    VALUES (v_cat, fx.org_a, 'AUD57RLS administracion', 'Administracion');
  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
     fecha_emision, moneda, subtotal, total, estado, estado_aprobacion)
    VALUES (v_pf, fx.org_a, v_prov, v_cat, 'AUD57RLS', public.fecha_negocio_mx(),
      'USD', 116, 116, 'Vigente', 'pendiente');
  INSERT INTO public.bitacora_actividad(organization_id, entidad_id, modulo, accion, detalles, usuario_email)
    VALUES (fx.org_a, v_pf, 'cxp', 'crear', '{"total":116,"moneda":"MXN"}', 'org-a@test.local'),
      (fx.org_b, v_pf, 'cxp', 'editar', '{"total":999,"moneda":"EUR"}', 'org-b@test.local');

  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'creada';
  PERFORM pg_temp.assert(v_evento.monto IS NOT DISTINCT FROM 116::numeric AND v_evento.moneda IS NOT DISTINCT FROM 'MXN',
    'AUD57RLS: miembro debe leer snapshot real y no datos actuales');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.historial_proveedor_factura(v_pf)
    WHERE actor_email = 'org-b@test.local'), 'AUD57RLS: bitácora cruzada no debe filtrarse');

  PERFORM pg_temp.as_user(fx.admin_b);
  v_error := NULL;
  BEGIN PERFORM public.historial_proveedor_factura(v_pf);
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(v_error IS NOT DISTINCT FROM 'Sin acceso a la factura', 'AUD57RLS: miembro de otro tenant debe ser rechazado');

  PERFORM pg_temp.as_user(v_sin_org);
  v_error := NULL;
  BEGIN PERFORM public.historial_proveedor_factura(v_pf);
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(v_error IS NOT DISTINCT FROM 'Sin acceso a la factura', 'AUD57RLS: usuario sin membresía debe ser rechazado');

  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  v_error := NULL;
  BEGIN PERFORM public.historial_proveedor_factura(v_pf);
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(v_error IS NOT DISTINCT FROM 'No autenticado', 'AUD57RLS: sesión sin uid no puede leer');

  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(NOT has_function_privilege('anon', 'public.historial_proveedor_factura(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.historial_proveedor_factura(uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.historial_proveedor_factura(uuid)', 'EXECUTE'),
    'AUD57RLS: ACL del historial no debe ampliarse a anon');
  PERFORM set_config('role', 'anon', true);
  v_error := NULL;
  BEGIN PERFORM public.historial_proveedor_factura(v_pf);
  EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(COALESCE(v_error LIKE 'permission denied for function historial_proveedor_factura%', false),
    'AUD57RLS: invocación anon debe fallar por ACL');

  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(v_super);
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'creada';
  PERFORM pg_temp.assert(v_evento.moneda IS NOT DISTINCT FROM 'MXN', 'AUD57RLS: super_admin conserva acceso y snapshot');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert((SELECT total = 116 AND moneda = 'USD' AND estado_aprobacion = 'pendiente'
    FROM public.proveedor_facturas WHERE id = v_pf), 'AUD57RLS: lecturas no alteran factura');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = v_pf)
    AND NOT EXISTS (SELECT 1 FROM public.proveedor_notas_credito WHERE proveedor_factura_id = v_pf),
    'AUD57RLS: pruebas de lectura no generan pagos/NC');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'PASS AUD-57 RLS: org propia, ajena, sin membresía, sin uid, anon y super_admin';
END;
$tests$;
ROLLBACK;
