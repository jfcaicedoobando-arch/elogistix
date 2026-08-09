-- Ola 6 — Integridad transaccional (A3, M3, M4, M7, M15)

-- A3: reactivar cotización con transición validada
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
BEGIN
  SELECT estado, estado_anterior, organization_id
    INTO v_estado, v_anterior, v_org
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
     SET estado = v_nuevo, estado_anterior = NULL, updated_at = now()
   WHERE id = p_id;
  RETURN v_nuevo::text;
END;
$$;
REVOKE ALL ON FUNCTION public.reactivar_cotizacion_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reactivar_cotizacion_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reactivar_cotizacion_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivar_cotizacion_rpc(uuid) TO service_role;

-- M3: prospecto → cliente (idempotente)
CREATE OR REPLACE FUNCTION public.convertir_prospecto_a_cliente_rpc(
  p_cotizacion_id uuid,
  p_cliente jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_es_prospecto boolean;
  v_cliente_id uuid;
  v_nombre text;
  v_rfc text;
  v_creado boolean := false;
BEGIN
  SELECT organization_id, es_prospecto, cliente_id
    INTO v_org, v_es_prospecto, v_cliente_id
  FROM public.cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Idempotencia: si ya se convirtió, devolver el cliente existente.
  IF v_cliente_id IS NOT NULL AND COALESCE(v_es_prospecto, false) = false THEN
    SELECT nombre INTO v_nombre FROM public.clientes WHERE id = v_cliente_id;
    RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', false);
  END IF;

  v_nombre := NULLIF(btrim(COALESCE(p_cliente->>'nombre', '')), '');
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE';
  END IF;
  v_rfc := NULLIF(btrim(upper(COALESCE(p_cliente->>'rfc', ''))), '');

  -- Reutiliza cliente existente con el mismo RFC dentro de la organización.
  IF v_rfc IS NOT NULL THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
    LIMIT 1;
  ELSE
    v_cliente_id := NULL;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      organization_id, nombre, contacto, email, telefono, rfc, direccion, ciudad, estado, cp
    ) VALUES (
      v_org,
      v_nombre,
      COALESCE(p_cliente->>'contacto', ''),
      COALESCE(p_cliente->>'email', ''),
      COALESCE(p_cliente->>'telefono', ''),
      COALESCE(v_rfc, ''),
      COALESCE(p_cliente->>'direccion', ''),
      COALESCE(p_cliente->>'ciudad', ''),
      COALESCE(p_cliente->>'estado', ''),
      COALESCE(p_cliente->>'cp', '')
    )
    RETURNING id INTO v_cliente_id;
    v_creado := true;
  END IF;

  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre,
         es_prospecto = false,
         updated_at = now()
   WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', v_creado);
END;
$$;
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO service_role;

-- M4: lead → cliente + oportunidad (atómico e idempotente)
CREATE OR REPLACE FUNCTION public.convertir_lead_rpc(
  p_lead_id uuid,
  p_crear_cliente boolean,
  p_cliente_id uuid,
  p_nombre_oportunidad text,
  p_monto_estimado numeric,
  p_moneda text,
  p_fecha_estimada_cierre date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.crm_leads;
  v_cliente_id uuid;
  v_cliente_nombre text := '';
  v_etapa_id uuid;
  v_prob integer;
  v_op_id uuid;
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

  -- Idempotencia: lead ya convertido devuelve los ids existentes.
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
    INSERT INTO public.clientes (organization_id, nombre, email, telefono, ciudad, contacto)
    VALUES (
      v_lead.organization_id,
      v_lead.empresa,
      COALESCE(v_lead.email, ''),
      COALESCE(v_lead.telefono, ''),
      COALESCE(v_lead.ciudad, ''),
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
    COALESCE(v_lead.vendedor_email, ''),
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
$$;
REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) TO service_role;

-- M7: tarifa + recargos en una sola transacción
CREATE OR REPLACE FUNCTION public.actualizar_tarifa_con_recargos_rpc(
  p_id uuid,
  p_tarifa jsonb,
  p_recargos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    agente_id = COALESCE((p_tarifa->>'agente_id')::uuid, agente_id),
    naviera_id = COALESCE((p_tarifa->>'naviera_id')::uuid, naviera_id),
    ruta_id = COALESCE((p_tarifa->>'ruta_id')::uuid, ruta_id),
    tipo_contenedor_id = COALESCE((p_tarifa->>'tipo_contenedor_id')::uuid, tipo_contenedor_id),
    flete_base = COALESCE((p_tarifa->>'flete_base')::numeric, flete_base),
    dias_libres_demoras = COALESCE((p_tarifa->>'dias_libres_demoras')::integer, dias_libres_demoras),
    vigente_desde = NULLIF(p_tarifa->>'vigente_desde', '')::date,
    vigente_hasta = NULLIF(p_tarifa->>'vigente_hasta', '')::date,
    transit_time_dias = NULLIF(p_tarifa->>'transit_time_dias', '')::integer,
    notas = p_tarifa->>'notas',
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
$$;
REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO service_role;

-- M15: eliminar proforma sólo si no está facturada
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
  IF v_factura IS NOT NULL OR v_factura2 IS NOT NULL
     OR NULLIF(btrim(COALESCE(v_folio_ext, '')), '') IS NOT NULL
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