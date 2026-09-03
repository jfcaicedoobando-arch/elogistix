-- P0 · Conversión canónica y atómica Prospecto → Cliente (forward-only).
-- Corrección: revinculación histórica por oportunidad (identidad), nunca por
-- nombre de empresa; y rechazo de conversiones parciales/conflictivas del lead.
CREATE OR REPLACE FUNCTION public.convertir_prospecto_a_cliente_rpc(p_cotizacion_id uuid, p_cliente jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_prospecto boolean;
  v_cliente_id uuid;
  v_estado text;
  v_oportunidad_id uuid;
  v_nombre text;
  v_nombre_canonico text;
  v_rfc text;
  v_rfc_real boolean;
  v_creado boolean := false;
  v_lead_id uuid;
  v_revinculadas int := 0;
  v_op_org uuid;
  v_op_cliente uuid;
  v_op_ganadora uuid;
  v_op_etapa uuid;
  v_etapa_tipo text;
  v_lead_org uuid;
  v_lead_cliente uuid;
  v_lead_op uuid;
  v_faltantes text[] := ARRAY[]::text[];
  v_contacto text; v_email text; v_telefono text; v_cp text; v_direccion text;
  v_ciudad text; v_estado_dir text;
  v_regimen text; v_uso text; v_forma text; v_metodo text;
  v_coherente boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_SESION_REQUERIDA' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, es_prospecto, cliente_id, estado::text, oportunidad_id
    INTO v_org, v_es_prospecto, v_cliente_id, v_estado, v_oportunidad_id
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;

  -- Autorización ANTES de cualquier retorno (incluido el idempotente).
  IF NOT public.is_org_member(v_org) OR NOT public.rls_tenant_scope_ok(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role_in_org(
        auth.uid(),
        ARRAY['admin','admin_org','operador','contador','super_admin']::app_role[],
        v_org) THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;

  ------------------------------------------------------------------
  -- Idempotencia segura: sólo si la conversión previa es coherente.
  ------------------------------------------------------------------
  IF v_cliente_id IS NOT NULL AND COALESCE(v_es_prospecto, false) = false THEN
    v_coherente := false;
    IF v_oportunidad_id IS NOT NULL THEN
      SELECT o.organization_id, o.cliente_id, o.cotizacion_ganadora_id, o.lead_id
        INTO v_op_org, v_op_cliente, v_op_ganadora, v_lead_id
      FROM public.crm_oportunidades o
      WHERE o.id = v_oportunidad_id AND o.deleted_at IS NULL;

      IF v_lead_id IS NOT NULL THEN
        SELECT l.organization_id, l.cliente_convertido_id, l.oportunidad_convertida_id
          INTO v_lead_org, v_lead_cliente, v_lead_op
        FROM public.crm_leads l
        WHERE l.id = v_lead_id AND l.deleted_at IS NULL;
      END IF;

      v_coherente :=
        v_op_org = v_org
        AND v_op_cliente = v_cliente_id
        AND v_op_ganadora = p_cotizacion_id
        AND v_lead_org = v_org
        AND v_lead_cliente = v_cliente_id
        AND v_lead_op = v_oportunidad_id
        AND EXISTS (
          SELECT 1 FROM public.clientes c
          WHERE c.id = v_cliente_id AND c.organization_id = v_org AND c.deleted_at IS NULL
        );
    END IF;

    IF v_coherente THEN
      SELECT nombre INTO v_nombre FROM public.clientes WHERE id = v_cliente_id;
      RETURN jsonb_build_object(
        'cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', false,
        'oportunidad_id', v_oportunidad_id, 'lead_id', v_lead_id,
        'cotizaciones_revinculadas', 0, 'sin_cambios', true
      );
    END IF;

    -- Ni conversión coherente ni prospecto: no puede disfrazarse de reintento.
    IF v_oportunidad_id IS NULL OR v_op_ganadora IS DISTINCT FROM p_cotizacion_id THEN
      RAISE EXCEPTION 'LC_COTIZACION_NO_ES_PROSPECTO';
    END IF;
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE';
  END IF;

  ------------------------------------------------------------------
  -- Primera conversión: validar TODO antes de crear/escribir.
  ------------------------------------------------------------------
  IF COALESCE(v_es_prospecto, false) = false THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ES_PROSPECTO';
  END IF;
  IF v_cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE';
  END IF;
  IF v_estado IS DISTINCT FROM 'Aceptada' THEN
    RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO';
  END IF;
  IF v_oportunidad_id IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_SIN_OPORTUNIDAD';
  END IF;

  SELECT o.organization_id, o.cliente_id, o.cotizacion_ganadora_id, o.lead_id, o.etapa_id
    INTO v_op_org, v_op_cliente, v_op_ganadora, v_lead_id, v_op_etapa
  FROM public.crm_oportunidades o
  WHERE o.id = v_oportunidad_id AND o.deleted_at IS NULL
  FOR UPDATE;
  IF v_op_org IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_NO_ENCONTRADA';
  END IF;
  IF v_op_org <> v_org THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;
  IF v_op_ganadora IS DISTINCT FROM p_cotizacion_id THEN
    RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE';
  END IF;
  IF v_op_cliente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_YA_CONVERTIDA';
  END IF;

  SELECT e.tipo::text INTO v_etapa_tipo
  FROM public.crm_etapas_pipeline e
  WHERE e.id = v_op_etapa AND e.organization_id = v_org AND e.deleted_at IS NULL;
  IF v_etapa_tipo IS DISTINCT FROM 'ganada' THEN
    RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_GANADA';
  END IF;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_PROSPECTO';
  END IF;
  SELECT l.organization_id, l.cliente_convertido_id, l.oportunidad_convertida_id
    INTO v_lead_org, v_lead_cliente, v_lead_op
  FROM public.crm_leads l
  WHERE l.id = v_lead_id AND l.deleted_at IS NULL
  FOR UPDATE;
  IF v_lead_org IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_PROSPECTO';
  END IF;
  IF v_lead_org <> v_org THEN
    RAISE EXCEPTION 'LC_CRM_LEAD_AJENO' USING ERRCODE = '42501';
  END IF;
  IF v_lead_cliente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_YA_CONVERTIDA';
  END IF;
  -- Conversión parcial/conflictiva: el lead ya apunta a otra oportunidad.
  IF v_lead_op IS NOT NULL AND v_lead_op <> v_oportunidad_id THEN
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE';
  END IF;

  ------------------------------------------------------------------
  -- Datos del cliente: normalización + captura fiscal completa.
  ------------------------------------------------------------------
  v_nombre    := NULLIF(btrim(COALESCE(p_cliente->>'nombre', '')), '');
  v_contacto  := NULLIF(btrim(COALESCE(p_cliente->>'contacto', '')), '');
  v_email     := NULLIF(lower(btrim(COALESCE(p_cliente->>'email', ''))), '');
  v_telefono  := NULLIF(btrim(COALESCE(p_cliente->>'telefono', '')), '');
  v_rfc       := NULLIF(upper(btrim(COALESCE(p_cliente->>'rfc', ''))), '');
  v_direccion := NULLIF(btrim(COALESCE(p_cliente->>'direccion', '')), '');
  v_ciudad    := NULLIF(btrim(COALESCE(p_cliente->>'ciudad', '')), '');
  v_estado_dir:= NULLIF(btrim(COALESCE(p_cliente->>'estado', '')), '');
  v_cp        := NULLIF(btrim(COALESCE(p_cliente->>'cp', '')), '');
  v_regimen   := NULLIF(btrim(COALESCE(p_cliente->>'regimen_fiscal', '')), '');
  v_uso       := NULLIF(btrim(COALESCE(p_cliente->>'uso_cfdi_default', '')), '');
  v_forma     := NULLIF(btrim(COALESCE(p_cliente->>'forma_pago_default', '')), '');
  v_metodo    := NULLIF(btrim(COALESCE(p_cliente->>'metodo_pago_default', '')), '');

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE';
  END IF;

  v_rfc_real := v_rfc IS NOT NULL AND v_rfc NOT IN ('XAXX010101000', 'XEXX010101000');

  IF v_contacto IS NULL THEN v_faltantes := v_faltantes || 'contacto'::text; END IF;
  IF v_email IS NULL THEN v_faltantes := v_faltantes || 'email'::text; END IF;
  IF v_telefono IS NULL THEN v_faltantes := v_faltantes || 'telefono'::text; END IF;
  IF v_rfc IS NULL THEN v_faltantes := v_faltantes || 'rfc'::text; END IF;
  IF v_cp IS NULL THEN v_faltantes := v_faltantes || 'cp'::text; END IF;
  IF v_regimen IS NULL THEN v_faltantes := v_faltantes || 'regimen_fiscal'::text; END IF;
  IF v_uso IS NULL THEN v_faltantes := v_faltantes || 'uso_cfdi_default'::text; END IF;
  IF v_forma IS NULL THEN v_faltantes := v_faltantes || 'forma_pago_default'::text; END IF;
  IF v_metodo IS NULL THEN v_faltantes := v_faltantes || 'metodo_pago_default'::text; END IF;
  IF v_rfc_real AND v_direccion IS NULL THEN v_faltantes := v_faltantes || 'direccion'::text; END IF;
  IF array_length(v_faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_FISCAL_INCOMPLETO: %', array_to_string(v_faltantes, ', ');
  END IF;

  ------------------------------------------------------------------
  -- Cliente: reutiliza por RFC real vivo, o crea (carrera tolerada).
  ------------------------------------------------------------------
  IF v_rfc_real THEN
    SELECT id, nombre INTO v_cliente_id, v_nombre_canonico
    FROM public.clientes
    WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    BEGIN
      INSERT INTO public.clientes (
        organization_id, nombre, contacto, email, telefono, rfc,
        direccion, ciudad, estado, cp,
        regimen_fiscal, uso_cfdi_default, forma_pago_default, metodo_pago_default
      ) VALUES (
        v_org, v_nombre, v_contacto, v_email, v_telefono, v_rfc,
        COALESCE(v_direccion, ''), COALESCE(v_ciudad, ''), COALESCE(v_estado_dir, ''), v_cp,
        v_regimen, v_uso, v_forma, v_metodo
      )
      RETURNING id, nombre INTO v_cliente_id, v_nombre_canonico;
      v_creado := true;
    EXCEPTION WHEN unique_violation THEN
      IF SQLERRM NOT LIKE '%clientes_org_rfc_unique%' THEN
        RAISE;
      END IF;
      SELECT id, nombre INTO v_cliente_id, v_nombre_canonico
      FROM public.clientes
      WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
      LIMIT 1;
      IF v_cliente_id IS NULL THEN RAISE; END IF;
      v_creado := false;
    END;
  END IF;

  v_nombre_canonico := COALESCE(NULLIF(btrim(COALESCE(v_nombre_canonico, '')), ''), v_nombre);

  ------------------------------------------------------------------
  -- Escrituras atómicas: cotización → historial → oportunidad → lead.
  ------------------------------------------------------------------
  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre_canonico,
         es_prospecto = false,
         updated_at = now()
   WHERE id = p_cotizacion_id;

  -- Revinculación histórica por IDENTIDAD (oportunidad), nunca por nombre de
  -- empresa: dos "ACME" distintas no deben mezclarse.
  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre_canonico,
         es_prospecto = false,
         updated_at = now()
   WHERE organization_id = v_org
     AND id <> p_cotizacion_id
     AND deleted_at IS NULL
     AND oportunidad_id = v_oportunidad_id
     AND COALESCE(es_prospecto, false) = true
     AND cliente_id IS NULL;
  GET DIAGNOSTICS v_revinculadas = ROW_COUNT;

  UPDATE public.crm_oportunidades
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre_canonico,
         updated_at = now()
   WHERE id = v_oportunidad_id AND organization_id = v_org;

  UPDATE public.crm_leads
     SET estado = 'Convertido'::crm_lead_estado,
         cliente_convertido_id = v_cliente_id,
         oportunidad_convertida_id = v_oportunidad_id,
         updated_at = now()
   WHERE id = v_lead_id AND organization_id = v_org;

  -- Bitácora: exactamente una actividad, sólo en la primera conversión.
  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_org, auth.uid(), 'convertir_prospecto_a_cliente', 'cotizaciones',
    p_cotizacion_id, v_nombre_canonico,
    jsonb_build_object(
      'cliente_id', v_cliente_id,
      'cliente_creado', v_creado,
      'oportunidad_id', v_oportunidad_id,
      'lead_id', v_lead_id,
      'cotizaciones_revinculadas', v_revinculadas
    )
  );

  RETURN jsonb_build_object(
    'cliente_id', v_cliente_id, 'nombre', v_nombre_canonico, 'creado', v_creado,
    'oportunidad_id', v_oportunidad_id, 'lead_id', v_lead_id,
    'cotizaciones_revinculadas', v_revinculadas, 'sin_cambios', false
  );
END;
$function$;

ALTER FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.convertir_prospecto_a_cliente_rpc(uuid, jsonb) IS
  'Conversión canónica y atómica Prospecto → Cliente. Exige sesión, membresía, tenant activo y rol de alta de clientes; la cotización debe ser prospecto Aceptada, ganadora de su oportunidad, con etapa ganada y lead vivo sin conversión previa a otra oportunidad. Revincula historial sólo por oportunidad_id. Reintento idempotente sólo si la conversión previa es coherente.';