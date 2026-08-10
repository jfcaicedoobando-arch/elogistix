-- RG10 (Ola 3): eliminar_proforma_rpc bloqueaba por `folio_factura_externa`
-- con texto aunque no hubiera factura viva (folio huérfano capturado por
-- error). Sólo se bloquea por factura viva o estado 'facturada'.
CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_numero text;
  v_estado text;
  v_factura uuid;
  v_factura2 uuid;
  v_folio_ext text;
  v_deleted timestamptz;
  v_embarque uuid;
BEGIN
  SELECT organization_id, numero, estado_proforma, factura_id, factura_secundaria_id,
         folio_factura_externa, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_factura, v_factura2, v_folio_ext, v_deleted, v_embarque
  FROM public.proformas WHERE id = p_proforma_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', false);
  END IF;
  -- RG10: el folio externo suelto ya NO bloquea; sólo una factura viva o el
  -- estado 'facturada'.
  IF v_factura IS NOT NULL OR v_factura2 IS NOT NULL
     OR lower(COALESCE(v_estado, '')) = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;

  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;

  UPDATE public.proformas
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_proforma_id;

  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', true);
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO service_role;

-- RG11 (Ola 3): la reactivación manual permitía saltar a 'Aceptada' por
-- UPDATE directo, sin el snapshot/versionado del flujo de aceptación.
CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_old text := OLD.estado::text;
  v_new text := NEW.estado::text;
BEGIN
  IF v_old IS NULL OR v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Vencida siempre puede aplicarse desde cualquier estado no terminal
  IF v_new = 'Vencida' AND v_old IN ('Solicitada','Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;

  -- Housekeeping: Vencida >90 días → Archivada (C5)
  IF v_old = 'Vencida' AND v_new = 'Archivada' THEN
    RETURN NEW;
  END IF;

  -- Reactivación manual desde estados de housekeeping (A3).
  -- RG11: 'Aceptada' fuera de la lista (requiere snapshot del flujo normal).
  IF v_old IN ('Vencida','Archivada')
     AND v_new IN ('Solicitada','Borrador','Enviada') THEN
    RETURN NEW;
  END IF;

  -- Transiciones válidas
  IF (v_old = 'Solicitada'    AND v_new IN ('Borrador','Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Borrador'      AND v_new IN ('Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
  OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM anon;
GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO authenticated, service_role;

-- RG12 (Ola 3): reactivar a 'Enviada' con fecha_vigencia expirada hacía que
-- el job la revenciera la misma noche. Se prorroga a CURRENT_DATE + 7.
CREATE OR REPLACE FUNCTION public.reactivar_cotizacion_rpc(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado estado_cotizacion;
  v_anterior estado_cotizacion;
  v_org uuid;
  v_nuevo estado_cotizacion;
  v_vigencia date;
BEGIN
  SELECT estado, estado_anterior, organization_id, fecha_vigencia
    INTO v_estado, v_anterior, v_org, v_vigencia
  FROM public.cotizaciones WHERE id = p_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  IF v_estado NOT IN ('Vencida'::estado_cotizacion, 'Archivada'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_REACTIVABLE';
  END IF;
  v_nuevo := CASE
    WHEN v_anterior IS NOT NULL
     AND v_anterior NOT IN ('Vencida'::estado_cotizacion, 'Archivada'::estado_cotizacion)
    THEN v_anterior
    ELSE 'Borrador'::estado_cotizacion
  END;
  UPDATE public.cotizaciones
     SET estado = v_nuevo,
         estado_anterior = NULL,
         updated_at = now(),
         -- RG12: prórroga sólo si vuelve a 'Enviada' con vigencia vencida/nula.
         fecha_vigencia = CASE
           WHEN v_nuevo = 'Enviada'::estado_cotizacion
            AND (v_vigencia IS NULL OR v_vigencia < CURRENT_DATE)
           THEN CURRENT_DATE + 7
           ELSE fecha_vigencia
         END
   WHERE id = p_id;
  RETURN v_nuevo::text;
END;
$$;
REVOKE ALL ON FUNCTION public.reactivar_cotizacion_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reactivar_cotizacion_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reactivar_cotizacion_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivar_cotizacion_rpc(uuid) TO service_role;

-- RG13 (Ola 3): la oportunidad heredaba vendedor_id del usuario que convierte
-- pero dejaba vendedor_email vacío. Se cae al email del usuario actual.
CREATE OR REPLACE FUNCTION public.convertir_lead_rpc(p_lead_id uuid, p_crear_cliente boolean, p_cliente_id uuid, p_nombre_oportunidad text, p_monto_estimado numeric, p_moneda text, p_fecha_estimada_cierre date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.crm_leads;
  v_cliente_id uuid;
  v_cliente_nombre text := '';
  v_etapa_id uuid;
  v_prob integer;
  v_op_id uuid;
  v_email_actual text;
BEGIN
  SELECT * INTO v_lead FROM public.crm_leads
   WHERE id = p_lead_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_NO_ENCONTRADO';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_lead.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  IF v_lead.estado = 'Convertido'::crm_lead_estado AND v_lead.oportunidad_convertida_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'cliente_id', v_lead.cliente_convertido_id,
      'oportunidad_id', v_lead.oportunidad_convertida_id,
      'creado', false
    );
  END IF;

  IF NULLIF(btrim(COALESCE(p_nombre_oportunidad, '')), '') IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_NOMBRE';
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre
    FROM public.clientes
    WHERE id = p_cliente_id AND organization_id = v_lead.organization_id AND deleted_at IS NULL;
    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'LC_CLIENTE_NO_ENCONTRADO';
    END IF;
  ELSIF COALESCE(p_crear_cliente, false) THEN
    INSERT INTO public.clientes (
      organization_id, nombre, rfc, direccion, ciudad, estado, cp, email, telefono, contacto
    )
    VALUES (
      v_lead.organization_id,
      v_lead.empresa,
      '',
      '',
      COALESCE(v_lead.ciudad, ''),
      '',
      '',
      COALESCE(v_lead.email, ''),
      COALESCE(v_lead.telefono, ''),
      COALESCE(v_lead.contacto, '')
    )
    RETURNING id, nombre INTO v_cliente_id, v_cliente_nombre;
  END IF;

  SELECT id, COALESCE(probabilidad_default, 0) INTO v_etapa_id, v_prob
  FROM public.crm_etapas_pipeline
  WHERE tipo = 'abierta' AND activa = true AND organization_id = v_lead.organization_id
  ORDER BY orden ASC
  LIMIT 1;
  IF v_etapa_id IS NULL THEN
    RAISE EXCEPTION 'LC_PIPELINE_SIN_ETAPAS';
  END IF;

  -- RG13: fallback al correo del usuario que convierte, en línea con
  -- `vendedor_id = COALESCE(v_lead.vendedor_id, auth.uid())`.
  SELECT email INTO v_email_actual FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.crm_oportunidades (
    organization_id, nombre, lead_id, cliente_id, cliente_nombre, etapa_id, probabilidad,
    monto_estimado, moneda, fecha_estimada_cierre, vendedor_id, vendedor_email, modo, created_by
  ) VALUES (
    v_lead.organization_id,
    btrim(p_nombre_oportunidad),
    v_lead.id,
    v_cliente_id,
    COALESCE(v_cliente_nombre, ''),
    v_etapa_id,
    v_prob,
    COALESCE(p_monto_estimado, 0),
    COALESCE(NULLIF(p_moneda, ''), 'MXN'),
    p_fecha_estimada_cierre,
    COALESCE(v_lead.vendedor_id, auth.uid()),
    COALESCE(NULLIF(btrim(COALESCE(v_lead.vendedor_email, '')), ''), v_email_actual, ''),
    COALESCE(v_lead.interes_modo, ''),
    auth.uid()
  )
  RETURNING id INTO v_op_id;

  UPDATE public.crm_leads
     SET estado = 'Convertido'::crm_lead_estado,
         cliente_convertido_id = v_cliente_id,
         oportunidad_convertida_id = v_op_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object('cliente_id', v_cliente_id, 'oportunidad_id', v_op_id, 'creado', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO service_role;

-- RG16 (Ola 3): la actualización parcial de tarifas usaba COALESCE y no
-- permitía LIMPIAR campos opcionales (mandar null/'' dejaba el valor viejo).
CREATE OR REPLACE FUNCTION public.actualizar_tarifa_con_recargos_rpc(p_id uuid, p_tarifa jsonb, p_recargos jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_tarifas WHERE id = p_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  UPDATE public.costeo_tarifas SET
    -- Campos opcionales: solo se tocan si la llave viene en el payload;
    -- null/'' limpia el valor (RG16).
    agente_id = CASE WHEN p_tarifa ? 'agente_id'
      THEN NULLIF(p_tarifa->>'agente_id', '')::uuid ELSE agente_id END,
    naviera_id = CASE WHEN p_tarifa ? 'naviera_id'
      THEN NULLIF(p_tarifa->>'naviera_id', '')::uuid ELSE naviera_id END,
    ruta_id = CASE WHEN p_tarifa ? 'ruta_id'
      THEN NULLIF(p_tarifa->>'ruta_id', '')::uuid ELSE ruta_id END,
    tipo_contenedor_id = CASE WHEN p_tarifa ? 'tipo_contenedor_id'
      THEN NULLIF(p_tarifa->>'tipo_contenedor_id', '')::uuid ELSE tipo_contenedor_id END,
    flete_base = CASE WHEN p_tarifa ? 'flete_base'
      THEN NULLIF(p_tarifa->>'flete_base', '')::numeric ELSE flete_base END,
    dias_libres_demoras = CASE WHEN p_tarifa ? 'dias_libres_demoras'
      THEN NULLIF(p_tarifa->>'dias_libres_demoras', '')::integer ELSE dias_libres_demoras END,
    -- Campos NOT NULL: nunca se anulan en una actualización parcial.
    vigente_desde = COALESCE(NULLIF(p_tarifa->>'vigente_desde', '')::date, vigente_desde),
    vigente_hasta = COALESCE(NULLIF(p_tarifa->>'vigente_hasta', '')::date, vigente_hasta),
    -- Campos opcionales (patrón original).
    transit_time_dias = CASE WHEN p_tarifa ? 'transit_time_dias'
      THEN NULLIF(p_tarifa->>'transit_time_dias', '')::integer ELSE transit_time_dias END,
    notas = CASE WHEN p_tarifa ? 'notas'
      THEN NULLIF(p_tarifa->>'notas', '') ELSE notas END,
    moneda = 'USD',
    updated_at = now()
  WHERE id = p_id;

  DELETE FROM public.costeo_tarifa_recargos WHERE tarifa_id = p_id;

  INSERT INTO public.costeo_tarifa_recargos (
    tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
  )
  SELECT
    p_id,
    v_org,
    btrim(r->>'concepto'),
    COALESCE(NULLIF(r->>'lado', ''), 'origen'),
    (r->>'monto')::numeric,
    'USD',
    COALESCE((r->>'incluido_en_total')::boolean, true)
  FROM jsonb_array_elements(COALESCE(p_recargos, '[]'::jsonb)) AS r
  WHERE NULLIF(btrim(COALESCE(r->>'concepto', '')), '') IS NOT NULL
    AND COALESCE((r->>'monto')::numeric, 0) > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO service_role;

-- RG22 (Ola 3): verificación fail-loud de la reescritura a public.org_scope().
DO $check$
DECLARE
  v_pat text := $q$current_user_org_id\(\)\s*OR\s+has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'(::app_role)?\s*\)$q$;
  v_pendientes text;
BEGIN
  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' ORDER BY p.proname)
    INTO v_pendientes
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND l.lanname IN ('sql', 'plpgsql')
    AND p.prosrc ~ v_pat;

  IF v_pendientes IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ORG_SCOPE_PENDIENTE: funciones aún con el predicado cross-org viejo (sin reescribir a public.org_scope()): %', v_pendientes;
  END IF;

  RAISE NOTICE 'Verificación org_scope(): ninguna función conserva el predicado cross-org viejo.';
END;
$check$;