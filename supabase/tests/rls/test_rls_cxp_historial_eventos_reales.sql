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
  v_miembro uuid := gen_random_uuid();
  v_caller uuid;
  v_accion text;
  v_log uuid;
  v_filas integer;
  v_datos jsonb;
  v_error text;
  v_evento record;
  v_updated_at timestamptz;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD57RLS');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_super, 'super_admin'), (v_sin_org, 'contador');
  INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (fx.org_a, v_miembro, 'customer_service');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_miembro, 'customer_service')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
    VALUES (v_prov, fx.org_a, 'AUD57RLS proveedor', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
    VALUES (v_cat, fx.org_a, 'AUD57RLS administracion', 'Administracion');
  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
     fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion, created_by)
    VALUES (v_pf, fx.org_a, v_prov, v_cat, 'AUD57RLS', public.fecha_negocio_mx(),
      'USD', 20, 116, 116, 'Vigente', 'pendiente', fx.admin_a);
  INSERT INTO public.bitacora_actividad(organization_id, entidad_id, modulo, accion, detalles, usuario_email)
    VALUES (fx.org_a, v_pf, 'cxp', 'crear', '{"total":116,"moneda":"MXN"}', 'org-a@test.local'),
      (fx.org_b, v_pf, 'cxp', 'editar', '{"total":999,"moneda":"EUR"}', 'org-b@test.local');
  SELECT updated_at INTO v_updated_at FROM public.proveedor_facturas WHERE id = v_pf;

  -- El defecto OLD era de confianza en el historial, no una aprobación real.
  PERFORM pg_temp.as_user(v_miembro);
  v_error := NULL;
  BEGIN PERFORM public.aprobar_factura_proveedor(v_pf, true, 'Aprobacion falsa de prueba', v_updated_at);
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(COALESCE(v_error LIKE 'LC_SOD_VIOLATION:%', false),
    'AUD57RLS: miembro sin rol no debe aprobar por RPC de negocio');
  FOREACH v_caller IN ARRAY ARRAY[v_miembro, fx.admin_a] LOOP
    PERFORM pg_temp.as_user(v_caller);
    FOREACH v_accion IN ARRAY ARRAY['aprobar_factura_proveedor', 'rechazar_factura_proveedor', ' APROBAR_FACTURA_PROVEEDOR '] LOOP
      v_error := NULL;
      BEGIN
        PERFORM public.registrar_bitacora('cxp', v_accion, v_pf, 'Factura aprobada falsamente',
          '{"total":999,"moneda":"USD","fuente_evento":"rpc_aprobar_factura_proveedor"}', fx.org_a, fx.admin_a);
      EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
      IF v_error IS NULL AND EXISTS (SELECT 1 FROM public.historial_proveedor_factura(v_pf)
        WHERE tipo = 'aprobada' AND monto = 999) THEN
        RAISE EXCEPTION 'AUD57RLS: recorder aceptó acción reservada y el historial promovió una aprobación falsa';
      END IF;
      PERFORM pg_temp.assert(COALESCE(v_error LIKE 'LC_BITACORA_ACCION_RESERVADA:%', false),
        'AUD57RLS: recorder aceptó acción reservada');
    END LOOP;
  END LOOP;
  PERFORM pg_temp.assert((SELECT estado_aprobacion = 'pendiente' FROM public.proveedor_facturas WHERE id = v_pf),
    'AUD57RLS: intentos de bitácora no cambian estado real');

  PERFORM pg_temp.as_user(v_miembro);
  FOREACH v_accion IN ARRAY ARRAY['editar', 'aprobada', 'rechazada'] LOOP
    PERFORM public.registrar_bitacora('cxp', v_accion, v_pf, 'Factura aprobada',
      '{"total":999,"moneda":"USD","procedencia_verificada":true,"snapshot_historico_disponible":true,"fuente_evento":"rpc_aprobar_factura_proveedor"}', fx.org_a);
    SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
      WHERE detalles->>'accion_registrada' = v_accion;
    PERFORM pg_temp.assert(v_evento.tipo IS NOT DISTINCT FROM 'actividad'
      AND v_evento.monto IS NULL AND v_evento.moneda IS NULL
      AND v_evento.detalles->>'procedencia_verificada' IS NOT DISTINCT FROM 'false'
      AND v_evento.detalles->>'snapshot_historico_disponible' IS NOT DISTINCT FROM 'false'
      AND v_evento.detalles->>'fuente_evento' IS NULL,
      'AUD57RLS: JSON o alias genérico certificó una decisión/snapshot');
  END LOOP;
  FOREACH v_datos IN ARRAY ARRAY['[{"procedencia_verificada":true}]'::jsonb, '"nota legacy"'::jsonb] LOOP
    PERFORM public.registrar_bitacora('cxp', 'legacy_formato', v_pf, 'Registro legacy', v_datos, fx.org_a);
    SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
      WHERE detalles->'datos_originales' = v_datos;
    PERFORM pg_temp.assert(v_evento.tipo IS NOT DISTINCT FROM 'actividad'
      AND jsonb_typeof(v_evento.detalles) IS NOT DISTINCT FROM 'object'
      AND v_evento.detalles->>'procedencia_verificada' IS NOT DISTINCT FROM 'false',
      'AUD57RLS: payload array/scalar escondió el aviso de procedencia');
  END LOOP;
  SELECT id INTO v_log FROM public.bitacora_actividad
    WHERE entidad_id = v_pf AND accion = 'editar' AND organization_id = fx.org_a;
  PERFORM pg_temp.assert(v_log IS NOT NULL, 'AUD57RLS: no se registró actividad genérica de prueba');
  UPDATE public.bitacora_actividad SET fuente_evento = 'rpc_aprobar_factura_proveedor' WHERE id = v_log;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  PERFORM pg_temp.assert(v_filas = 0 AND (SELECT fuente_evento IS NULL FROM public.bitacora_actividad WHERE id = v_log),
    'AUD57RLS: UPDATE directo certificó la columna física pese a RLS');
  v_error := NULL;
  BEGIN
    INSERT INTO public.bitacora_actividad(organization_id, entidad_id, modulo, accion, fuente_evento)
      VALUES (fx.org_a, v_pf, 'cxp', 'aprobar_factura_proveedor', 'rpc_aprobar_factura_proveedor');
  EXCEPTION WHEN insufficient_privilege THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT; END;
  PERFORM pg_temp.assert(v_error IS NOT NULL, 'AUD57RLS: INSERT directo certificó la columna física pese a RLS');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo IN ('aprobada', 'rechazada')), 'AUD57RLS: factura pendiente obtuvo decisión canónica falsa');

  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'creada';
  PERFORM pg_temp.assert(v_evento.monto IS NULL AND v_evento.moneda IS NULL,
    'AUD57RLS: captura no debe inferir monto actual ni declarativo');
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE detalles->>'accion_registrada' = 'crear';
  PERFORM pg_temp.assert(v_evento.detalles->>'moneda' IS NOT DISTINCT FROM 'MXN'
    AND v_evento.detalles->>'procedencia_verificada' IS NOT DISTINCT FROM 'false',
    'AUD57RLS: captura declarada antigua debe conservarse como no verificada');
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
  PERFORM pg_temp.assert(v_evento.tipo IS NOT DISTINCT FROM 'creada' AND v_evento.moneda IS NULL,
    'AUD57RLS: super_admin conserva acceso sin certificar valores genéricos');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert((SELECT total = 116 AND moneda = 'USD' AND estado_aprobacion = 'pendiente'
    FROM public.proveedor_facturas WHERE id = v_pf), 'AUD57RLS: lecturas no alteran factura');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = v_pf)
    AND NOT EXISTS (SELECT 1 FROM public.proveedor_notas_credito WHERE proveedor_factura_id = v_pf),
    'AUD57RLS: pruebas de lectura no generan pagos/NC');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id, proveedor_factura_id, descripcion, cantidad, monto)
    VALUES (fx.org_a, v_pf, 'Servicio AUD57RLS', 1, 116);
  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT updated_at INTO v_updated_at FROM public.proveedor_facturas WHERE id = v_pf;
  PERFORM public.aprobar_factura_proveedor(v_pf, true, 'Gasto de administración de prueba', v_updated_at);
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'aprobada';
  PERFORM pg_temp.assert(v_evento.monto IS NOT DISTINCT FROM 116::numeric AND v_evento.moneda IS NOT DISTINCT FROM 'USD'
    AND v_evento.detalles->>'procedencia_verificada' IS NOT DISTINCT FROM 'true'
    AND v_evento.detalles->>'fuente_evento' IS NOT DISTINCT FROM 'rpc_aprobar_factura_proveedor',
    'AUD57RLS: RPC real debe producir snapshot certificado por columna física');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'aprobada'),
    'AUD57RLS: decisión real no debe duplicarse con su fallback');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'PASS AUD-57 RLS: org propia, ajena, sin membresía, sin uid, anon y super_admin';
END;
$tests$;
ROLLBACK;
