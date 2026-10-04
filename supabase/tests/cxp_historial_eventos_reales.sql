-- AUD-57: fixtures nuevas y rollback; no reconstrucción ni backfill de datos reales.
BEGIN;
DO $t$
DECLARE
  v_org uuid;
  v_otra_org uuid;
  v_uid uuid := gen_random_uuid();
  v_prov uuid;
  v_cat uuid;
  v_pf uuid;
  v_legacy uuid;
  v_malformada uuid;
  v_futura uuid;
  v_fecha date := public.fecha_negocio_mx();
  v_captura timestamptz := '2026-10-01T10:00:00Z';
  v_aprobacion1 timestamptz := '2026-10-01T11:00:00Z';
  v_edicion timestamptz := '2026-10-02T10:00:00Z';
  v_aprobacion2 timestamptz := '2026-10-02T11:00:00Z';
  v_evento record;
  v_n integer;
BEGIN
  INSERT INTO public.organizations (nombre) VALUES ('TEST HISTORIAL REAL') RETURNING id INTO v_org;
  INSERT INTO public.organizations (nombre) VALUES ('TEST HISTORIAL OTRA ORG') RETURNING id INTO v_otra_org;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'historial-real@test.local');
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (v_org, v_uid, 'admin_org');
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
    VALUES (v_org, 'Administracion TEST historial', 1, true, 'Administracion') RETURNING id INTO v_cat;
  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
    VALUES (v_org, 'Proveedor TEST historial', 'Logistico', 'Naviera') RETURNING id INTO v_prov;
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id, subtotal, iva, total,
     moneda, tipo_cambio_usd, fecha_emision, estado, estado_aprobacion, created_at, aprobada_at, aprobada_por, created_by)
    VALUES (v_org, v_prov, 'TEST-HISTORIAL', v_cat, 100, 16, 116,
      'USD', 20, v_fecha, 'Vigente', 'aprobada', v_captura, v_aprobacion2, v_uid, v_uid) RETURNING id INTO v_pf;
  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, entidad_id, modulo, accion, detalles, created_at)
    VALUES
    (v_org, v_uid, 'captura-original@test.local', v_pf, 'cxp', 'crear',
      '{"total":116,"moneda":"MXN","folio_proveedor":"FOLIO-ORIGINAL"}', v_captura),
    (v_org, v_uid, 'primera-aprobacion@test.local', v_pf, 'cxp', 'aprobar_factura_proveedor',
      '{"total":116,"aprobada":true}', v_aprobacion1),
    (v_org, v_uid, 'edicion@test.local', v_pf, 'cxp', 'editar',
      '{"total":116,"moneda":"USD","forzo_reaprobacion":true}', v_edicion),
    (v_org, v_uid, 'segunda-aprobacion@test.local', v_pf, 'cxp', 'aprobar_factura_proveedor',
      '{"total":116,"moneda":"USD","aprobada":true}', v_aprobacion2),
    (v_org, v_uid, 'rechazo@test.local', v_pf, 'cxp', 'rechazar_factura_proveedor',
      '{"total":116,"moneda":"MXN","motivo":"Factura ilegible"}', v_aprobacion1 + interval '1 minute'),
    (v_org, v_uid, 'rechazo-legacy@test.local', v_pf, 'cxp', 'rechazar_factura_proveedor',
      '{"total":116,"moneda":"MXN","motivo_rechazo":"Motivo original"}', v_aprobacion1 + interval '2 minutes'),
    -- Una entidad_id coincidente jamás autoriza mostrar eventos de otra organización.
    (v_otra_org, v_uid, 'otra-org@test.local', v_pf, 'cxp', 'crear',
      '{"total":999,"moneda":"EUR"}', v_captura - interval '1 day');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'creada';
  IF v_evento.monto IS NOT NULL OR v_evento.moneda IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL captura genérica se convirtió en importe canónico: % %', v_evento.monto, v_evento.moneda;
  END IF;
  IF v_evento.ts IS DISTINCT FROM v_captura OR v_evento.actor_email IS DISTINCT FROM 'historial-real@test.local' THEN
    RAISE EXCEPTION 'FAIL captura alteró timestamp o actor persistidos';
  END IF;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND detalles->>'accion_registrada' = 'crear';
  IF NOT FOUND OR v_evento.monto IS NOT NULL OR v_evento.moneda IS NOT NULL
    OR v_evento.detalles->>'total' IS DISTINCT FROM '116'
    OR v_evento.detalles->>'moneda' IS DISTINCT FROM 'MXN'
    OR v_evento.detalles->>'folio_proveedor' IS DISTINCT FROM 'FOLIO-ORIGINAL'
    OR v_evento.detalles->>'procedencia_verificada' IS DISTINCT FROM 'false'
    OR v_evento.detalles->>'snapshot_historico_disponible' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'FAIL perdió datos declarados originales o certificó captura legacy';
  END IF;
  SELECT count(*) INTO v_n FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'creada';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL captura duplicada: %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'aprobada';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL promovió aprobaciones legacy o duplicó última decisión: %', v_n; END IF;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND ts = v_aprobacion2
      AND detalles->>'accion_registrada' = 'aprobar_factura_proveedor';
  IF NOT FOUND OR v_evento.actor_email IS DISTINCT FROM 'segunda-aprobacion@test.local'
    OR v_evento.monto IS NOT NULL OR v_evento.moneda IS NOT NULL
    OR v_evento.detalles->>'total' IS DISTINCT FROM '116'
    OR v_evento.detalles->>'moneda' IS DISTINCT FROM 'USD'
    OR v_evento.detalles->>'procedencia_verificada' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'FAIL ocultó la actividad legacy coincidente con la última decisión persistida';
  END IF;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND ts = v_aprobacion1;
  IF NOT FOUND OR v_evento.moneda IS NOT NULL OR v_evento.monto IS NOT NULL
    OR v_evento.detalles->>'snapshot_historico_disponible' IS DISTINCT FROM 'false'
    OR v_evento.detalles->>'procedencia_verificada' IS DISTINCT FROM 'false'
    OR v_evento.detalles->>'total' IS DISTINCT FROM '116' THEN
    RAISE EXCEPTION 'FAIL aprobación antigua ausente o certificada sin procedencia';
  END IF;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND ts = v_aprobacion1 + interval '1 minute';
  IF NOT FOUND OR v_evento.ts IS DISTINCT FROM v_aprobacion1 + interval '1 minute'
    OR v_evento.detalles->>'motivo_rechazo' IS DISTINCT FROM 'Factura ilegible' THEN
    RAISE EXCEPTION 'FAIL perdió rechazo o motivo histórico';
  END IF;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND ts = v_aprobacion1 + interval '2 minutes';
  IF NOT FOUND OR v_evento.detalles->>'motivo_rechazo' IS DISTINCT FROM 'Motivo original' THEN
    RAISE EXCEPTION 'FAIL sobrescribió motivo_rechazo histórico con NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM public.historial_proveedor_factura(v_pf) WHERE actor_email = 'otra-org@test.local') THEN
    RAISE EXCEPTION 'FAIL filtró evento de otra organización';
  END IF;
  UPDATE public.proveedor_facturas SET folio_proveedor = 'FOLIO-ACTUAL', total = 232, subtotal = 200, iva = 32,
    moneda = 'EUR', tipo_cambio_usd = 22 WHERE id = v_pf;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf)
    WHERE tipo = 'actividad' AND detalles->>'accion_registrada' = 'crear';
  IF v_evento.detalles->>'total' IS DISTINCT FROM '116' OR v_evento.detalles->>'moneda' IS DISTINCT FROM 'MXN'
    OR v_evento.detalles->>'folio_proveedor' IS DISTINCT FROM 'FOLIO-ORIGINAL' THEN
    RAISE EXCEPTION 'FAIL edición cambió los datos originales declarados';
  END IF;

  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id, subtotal, iva, total,
     moneda, fecha_emision, estado, estado_aprobacion, created_at, aprobada_at)
    VALUES (v_org, v_prov, 'TEST-LEGACY-HISTORIAL', v_cat, 99, 0, 99,
      'MXN', v_fecha, 'Vigente', 'aprobada', v_captura, v_aprobacion1) RETURNING id INTO v_legacy;
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_legacy) WHERE tipo = 'creada';
  IF v_evento.monto IS NOT NULL OR v_evento.moneda IS NOT NULL
    OR v_evento.detalles->>'snapshot_historico_disponible' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'FAIL inventó captura legacy sin snapshot';
  END IF;
  SELECT count(*) INTO v_n FROM public.historial_proveedor_factura(v_legacy) WHERE tipo = 'aprobada';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL perdió última decisión legacy conocida'; END IF;
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id, subtotal, iva, total, moneda, fecha_emision)
    VALUES (v_org, v_prov, 'TEST-MALFORMADA-HISTORIAL', v_cat, 1, 0, 1, 'MXN', v_fecha) RETURNING id INTO v_malformada;
  INSERT INTO public.bitacora_actividad (organization_id, entidad_id, modulo, accion, detalles)
    VALUES (v_org, v_malformada, 'cxp', 'crear', '{"total":"ilegible","moneda":"UNKNOWN"}');
  SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_malformada) WHERE tipo = 'creada';
  IF v_evento.monto IS NOT NULL OR v_evento.moneda IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL convirtió snapshot inválido en importe/moneda';
  END IF;

  -- El RPC real de aprobación guarda su propio snapshot para las decisiones futuras.
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id, subtotal, iva, total,
     moneda, tipo_cambio_usd, fecha_emision, estado, estado_aprobacion, created_by)
    VALUES (v_org, v_prov, 'TEST-FUTURA-HISTORIAL', v_cat, 100, 16, 116,
      'MXN', 20, v_fecha, 'Vigente', 'pendiente', v_uid) RETURNING id INTO v_futura;
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, descripcion, cantidad, monto)
    VALUES (v_org, v_futura, 'Servicio TEST historial', 1, 100);
  PERFORM public.aprobar_factura_proveedor(v_futura, true, 'Gasto de administración de prueba');
  UPDATE public.proveedor_facturas SET moneda = 'USD', estado_aprobacion = 'pendiente',
    aprobada_at = NULL, aprobada_por = NULL WHERE id = v_futura;
  PERFORM public.aprobar_factura_proveedor(v_futura, true, 'Gasto de administración de prueba');
  SELECT count(*) INTO v_n FROM public.historial_proveedor_factura(v_futura)
    WHERE tipo = 'aprobada' AND monto = 116 AND moneda IN ('MXN', 'USD')
      AND (detalles->>'tipo_cambio_usd')::numeric = 20
      AND detalles->>'procedencia_verificada' = 'true'
      AND detalles->>'fuente_evento' = 'rpc_aprobar_factura_proveedor';
  IF v_n <> 2 THEN RAISE EXCEPTION 'FAIL RPC no conservó moneda/TC de ambas decisiones futuras: %', v_n; END IF;
  IF (SELECT count(DISTINCT moneda) FROM public.historial_proveedor_factura(v_futura) WHERE tipo = 'aprobada') <> 2 THEN
    RAISE EXCEPTION 'FAIL una moneda actual reemplazó las decisiones futuras';
  END IF;
  IF (SELECT count(*) FROM public.historial_proveedor_factura(v_futura) WHERE tipo = 'aprobada') <> 2 THEN
    RAISE EXCEPTION 'FAIL duplicó aprobación futura con fallback';
  END IF;
  RAISE NOTICE 'PASS AUD-57 snapshots reales, decisiones completas, fallback explícito y sin duplicados';
END;
$t$;
ROLLBACK;
