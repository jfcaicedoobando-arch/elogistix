
-- =============================================================================
-- Fix: 6 RPCs insertaban en bitacora_actividad con columnas inexistentes
-- (user_id, entidad_tipo, entidad, metadata, detalle, tipo).
-- Esquema real: organization_id, usuario_id, usuario_email, accion, modulo,
--               entidad_id, entidad_nombre, detalles (jsonb).
-- =============================================================================

-- 1) set_facturapi_api_key
CREATE OR REPLACE FUNCTION public.set_facturapi_api_key(p_org_id uuid, p_ambiente text, p_api_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'extensions'
AS $function$
DECLARE
  v_key text := btrim(coalesce(p_api_key, ''));
  v_prefix_ok boolean;
  v_new_id uuid;
  v_old_id uuid;
  v_last4 text;
  v_name text;
BEGIN
  PERFORM public._assert_facturapi_admin(p_org_id);

  IF p_ambiente NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'ambiente_invalido' USING ERRCODE = '22023';
  END IF;
  IF length(v_key) < 16 THEN
    RAISE EXCEPTION 'api_key_invalida' USING ERRCODE = '22023';
  END IF;
  v_prefix_ok := (p_ambiente = 'sandbox' AND v_key LIKE 'sk_test_%')
              OR (p_ambiente = 'live'    AND v_key LIKE 'sk_live_%');
  IF NOT v_prefix_ok THEN
    RAISE EXCEPTION 'api_key_prefix_no_coincide_con_ambiente' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.facturapi_credenciales (organization_id, ambiente)
  VALUES (p_org_id, p_ambiente)
  ON CONFLICT (organization_id) DO NOTHING;

  v_last4 := right(v_key, 4);
  v_name  := 'facturapi:' || p_org_id::text || ':' || p_ambiente || ':' || gen_random_uuid()::text;
  v_new_id := vault.create_secret(v_key, v_name, 'FacturApi API key (' || p_ambiente || ') para org ' || p_org_id::text);

  IF p_ambiente = 'sandbox' THEN
    SELECT api_key_sandbox_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_sandbox_vault_id = v_new_id,
           api_key_sandbox_last4    = v_last4,
           updated_at               = now()
     WHERE organization_id = p_org_id;
  ELSE
    SELECT api_key_live_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_live_vault_id = v_new_id,
           api_key_live_last4    = v_last4,
           updated_at            = now()
     WHERE organization_id = p_org_id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_id;
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    p_org_id,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'facturapi_api_key_actualizada',
    'facturapi_credenciales',
    p_org_id,
    '',
    jsonb_build_object('ambiente', p_ambiente, 'last4', v_last4)
  );
END;
$function$;

-- 2) clear_facturapi_api_key
CREATE OR REPLACE FUNCTION public.clear_facturapi_api_key(p_org_id uuid, p_ambiente text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'extensions'
AS $function$
DECLARE
  v_old_id uuid;
BEGIN
  PERFORM public._assert_facturapi_admin(p_org_id);
  IF p_ambiente NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'ambiente_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ambiente = 'sandbox' THEN
    SELECT api_key_sandbox_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_sandbox_vault_id = NULL,
           api_key_sandbox_last4    = NULL,
           updated_at               = now()
     WHERE organization_id = p_org_id;
  ELSE
    SELECT api_key_live_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_live_vault_id = NULL,
           api_key_live_last4    = NULL,
           updated_at            = now()
     WHERE organization_id = p_org_id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_id;
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    p_org_id,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'facturapi_api_key_borrada',
    'facturapi_credenciales',
    p_org_id,
    '',
    jsonb_build_object('ambiente', p_ambiente)
  );
END;
$function$;

-- 3) aceptar_cotizacion_version
CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_version INT; v_org UUID; v_folio TEXT;
BEGIN
  SELECT version, organization_id, folio INTO v_version, v_org, v_folio FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  UPDATE cotizaciones SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
    estado='Aceptada', updated_at=now() WHERE id=p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'cotizacion.aceptada_version_fijada',
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_folio, ''),
    jsonb_build_object('version_aceptada', v_version)
  );
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_aceptada', v_version);
END $function$;

-- 4) recotizar_cotizacion
CREATE OR REPLACE FUNCTION public.recotizar_cotizacion(p_cotizacion_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_old INT; v_new INT; v_org UUID; v_folio TEXT;
BEGIN
  SELECT version, organization_id, folio INTO v_old, v_org, v_folio FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(p_motivo),'')='' THEN RAISE EXCEPTION 'Motivo requerido' USING ERRCODE='22023'; END IF;
  PERFORM archivar_version_cotizacion(p_cotizacion_id, p_motivo);
  v_new := v_old + 1;
  UPDATE cotizaciones SET version=v_new, estado='Borrador', updated_at=now() WHERE id=p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'cotizacion.versionada',
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_folio, ''),
    jsonb_build_object('version_anterior', v_old, 'version_nueva', v_new, 'motivo', p_motivo)
  );
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_anterior', v_old, 'version_nueva', v_new);
END $function$;

-- 5) convertir_proformas_a_factura -- sólo cambia el bloque de bitácora al final
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(p_proforma_ids uuid[], p_serie_id uuid, p_metodo_pago text, p_forma_pago text, p_uso_cfdi text, p_dias_credito integer DEFAULT 0, p_notas text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached         jsonb;
  v_factura        public.facturas;
  v_count          int;
  v_first          public.proformas;
  v_org            uuid;
  v_caller_org     uuid;
  v_cliente        public.clientes;
  v_serie          public.factura_series;
  v_folio          bigint;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_tipo_cambio    numeric;
  v_distinct_cli   int;
  v_distinct_org   int;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_factura FROM public.facturas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_factura; END IF;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

  SELECT count(*),
         count(DISTINCT organization_id),
         count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
    AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  SELECT * INTO v_first
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
  ORDER BY created_at ASC
  LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;
  PERFORM public._assert_writer(v_org);

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND (factura_id IS NOT NULL OR estado_proforma = 'facturada')
  ) THEN
    RAISE EXCEPTION 'Una o más proformas ya están facturadas';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND coalesce(estado_revision, '') <> 'aprobada'
  ) THEN
    RAISE EXCEPTION 'Todas las proformas deben estar en estado aprobada';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente.rfc IS NULL OR length(v_cliente.rfc) < 12 THEN
    RAISE EXCEPTION 'Cliente sin RFC válido';
  END IF;
  IF v_cliente.codigo_postal IS NULL OR v_cliente.codigo_postal !~ '^\d{5}$' THEN
    RAISE EXCEPTION 'Cliente sin código postal válido';
  END IF;
  IF v_cliente.regimen_fiscal IS NULL OR v_cliente.regimen_fiscal = '' THEN
    RAISE EXCEPTION 'Cliente sin régimen fiscal';
  END IF;

  SELECT * INTO v_serie FROM public.factura_series
   WHERE id = p_serie_id AND organization_id = v_org AND activa = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serie de facturación inválida para esta organización';
  END IF;
  SELECT folio, numero INTO v_folio, v_numero FROM public.reservar_folio_factura(p_serie_id);

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_tipo_cambio := CASE WHEN v_subtotal_usd > 0 THEN ROUND(v_subtotal_mxn / v_subtotal_usd, 4) ELSE 1 END;

  INSERT INTO public.facturas (
    numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, tipo_cambio,
    fecha_emision, fecha_vencimiento, estado,
    organization_id, proforma_id,
    serie_id, folio_fiscal, serie,
    rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
    notas, origen
  ) VALUES (
    v_numero, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
    v_subtotal_mxn, v_iva_mxn, v_total_mxn, 'MXN', v_tipo_cambio,
    CURRENT_DATE,
    CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
    'Borrador'::estado_factura,
    v_org,
    CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
    p_serie_id, v_folio, v_serie.prefijo,
    v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
    p_notas, 'conversion_proforma'
  )
  RETURNING * INTO v_factura;

  INSERT INTO public.conceptos_factura (
    factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
  )
  SELECT
    v_factura.id,
    pcc.descripcion,
    pcc.cantidad,
    pcc.precio_unitario,
    pcc.moneda,
    pcc.total,
    v_org,
    '78101800'
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = ANY(p_proforma_ids);

  UPDATE public.proformas
     SET factura_id      = v_factura.id,
         estado_proforma = 'facturada',
         fecha_facturacion = CURRENT_DATE,
         updated_at      = now()
   WHERE id = ANY(p_proforma_ids);

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'proforma_convertida_a_factura',
    'facturacion',
    v_factura.id,
    COALESCE(v_factura.numero, ''),
    jsonb_build_object(
      'proforma_ids', to_jsonb(p_proforma_ids),
      'factura_numero', v_factura.numero,
      'metodo_pago', p_metodo_pago,
      'fusion', array_length(p_proforma_ids, 1) > 1
    )
  );

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_factura.id));
  RETURN v_factura;
END;
$function$;

-- 6) duplicar_factura_para_sustitucion
CREATE OR REPLACE FUNCTION public.duplicar_factura_para_sustitucion(p_factura_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.facturas%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_old FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_caller
      AND organization_id = v_old.organization_id
      AND role IN ('admin_org','admin','super_admin','contabilidad')
  ) THEN
    RAISE EXCEPTION 'forbidden: requiere rol admin o contabilidad' USING ERRCODE = '42501';
  END IF;

  IF v_old.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'factura_sin_uuid: sólo se puede sustituir un CFDI timbrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_old.sustituida_por IS NOT NULL THEN
    RAISE EXCEPTION 'factura_ya_sustituida' USING ERRCODE = 'P0001';
  END IF;
  IF v_old.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = 'P0001';
  END IF;

  v_new_numero := v_old.numero || '-R';
  WHILE EXISTS (SELECT 1 FROM public.facturas WHERE organization_id = v_old.organization_id AND numero = v_new_numero) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl,
    snapshot_emision,
    estado, origen,
    sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_old.cliente_id, v_old.cliente_nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, v_old.proforma_id,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE, CURRENT_DATE + COALESCE(v_old.dias_credito, 0), v_old.dias_credito,
    v_old.moneda, v_old.tipo_cambio, v_old.subtotal, v_old.iva, v_old.total,
    v_old.metodo_pago, v_old.forma_pago, v_old.uso_cfdi, v_old.rfc_cliente,
    COALESCE(v_old.notas, '') || E'\n[Sustituye a ' || v_old.numero || ']',
    v_old.referencia_bl,
    v_old.snapshot_emision,
    'Borrador'::estado_factura, v_old.origen,
    v_old.id
  );

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id,
    v_caller,
    COALESCE((SELECT email FROM auth.users WHERE id = v_caller), ''),
    'factura_duplicada_para_sustitucion',
    'facturacion',
    v_new_id,
    COALESCE(v_new_numero, ''),
    jsonb_build_object('factura_original_id', v_old.id, 'factura_original_uuid', v_old.uuid_fiscal, 'numero_nuevo', v_new_numero)
  );

  RETURN v_new_id;
END;
$function$;
