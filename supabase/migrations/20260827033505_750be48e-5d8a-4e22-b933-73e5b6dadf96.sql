-- Cerrar el alta de clientes desde el CRM.
-- La conversión de lead corría con privilegios elevados (SECURITY DEFINER) y creaba
-- el cliente con los campos del lead, saltándose el gate de roles de public.clientes
-- y las validaciones fiscales del wizard "Nuevo cliente".
-- A partir de aquí: la conversión NO crea clientes; sólo liga uno existente.
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

  -- Candado: el alta de clientes vive sólo en el módulo de Clientes.
  IF COALESCE(p_crear_cliente, false) AND p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_ALTA_CLIENTE_PROHIBIDA';
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre
    FROM public.clientes
    WHERE id = p_cliente_id AND organization_id = v_lead.organization_id AND deleted_at IS NULL;
    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION 'LC_CLIENTE_NO_ENCONTRADO';
    END IF;
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

  -- O6.2: la oportunidad hereda sector/origen/destino del lead.
  INSERT INTO public.crm_oportunidades (
    organization_id, nombre, lead_id, cliente_id, cliente_nombre, etapa_id, probabilidad,
    monto_estimado, moneda, fecha_estimada_cierre, vendedor_id, vendedor_email, modo,
    sector, origen, destino, created_by
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
    v_lead.sector,
    COALESCE(v_lead.origen, ''),
    COALESCE(v_lead.destino, ''),
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

COMMENT ON FUNCTION public.convertir_lead_rpc(uuid, boolean, uuid, text, numeric, text, date) IS
  'Convierte un lead en oportunidad. NO crea clientes (LC_LEAD_ALTA_CLIENTE_PROHIBIDA): sólo liga un cliente existente de la misma organización.';