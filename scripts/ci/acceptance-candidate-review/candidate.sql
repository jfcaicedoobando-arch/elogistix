-- Aceptación canónica: cliente existente o prospecto CRM enviado.
-- Primera aceptación y reintento de prospecto se validan por separado.
-- No crea clientes, entidades CRM ni vínculos; conserva Aceptar → Convertir.

CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
  v_cliente_id UUID; v_requiere BOOLEAN; v_origen TEXT;
  v_creado_por UUID;
  v_uid UUID := auth.uid();
  v_admin BOOLEAN;
  v_oportunidad_id UUID;
  v_version_aceptada INT;
  v_op_existe BOOLEAN;
  v_ganadora UUID;
  v_tipo_documento TEXT;
  v_subtotal NUMERIC;
  v_es_prospecto BOOLEAN;
  v_conceptos JSONB;
  v_renglon_valido BOOLEAN;
  v_moneda TEXT; v_aceptada_en TIMESTAMPTZ; v_aceptada_por UUID;
  v_prospecto_sin_cliente BOOLEAN; v_reintento_prospecto BOOLEAN;
  v_op public.crm_oportunidades%ROWTYPE;
  v_etapa public.crm_etapas_pipeline%ROWTYPE;
  v_lead public.crm_leads%ROWTYPE;
  v_vinculo public.crm_oportunidad_empresa%ROWTYPE;
  v_empresa public.crm_empresas%ROWTYPE;
BEGIN
  -- v13.823.57: lock de la fila ANTES de validar; dos aceptaciones simultáneas
  -- se serializan y la segunda ve el estado ya terminal.
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id,
         created_by, oportunidad_id, version_aceptada,
         tipo_documento, subtotal, conceptos_venta, es_prospecto, moneda::text, aceptada_en, aceptada_por
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id,
         v_creado_por, v_oportunidad_id, v_version_aceptada,
         v_tipo_documento, v_subtotal, v_conceptos, v_es_prospecto, v_moneda, v_aceptada_en, v_aceptada_por
    FROM cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;


  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: se requiere sesión para aceptar cotizaciones' USING ERRCODE='42501';
  END IF;

  v_admin := public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org'])
    );

  IF NOT (
    v_admin
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['gerente_comercial','vendedor','operador','gerente_operaciones'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: tu rol no puede aceptar cotizaciones en esta organización' USING ERRCODE='42501';
  END IF;

  IF v_creado_por IS NOT NULL AND v_uid IS NOT NULL AND v_creado_por = v_uid AND NOT v_admin THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: quien creó la cotización no puede aceptarla' USING ERRCODE='42501';
  END IF;

  v_prospecto_sin_cliente := v_cliente_id IS NULL
    AND COALESCE(v_es_prospecto, false)
    AND COALESCE(v_tipo_documento, 'transaccional') = 'transaccional';
  v_reintento_prospecto := v_prospecto_sin_cliente AND v_estado_actual = 'Aceptada';

  IF COALESCE(v_tipo_documento, 'transaccional') <> 'informativa' THEN
    IF COALESCE(v_es_prospecto, false) AND v_oportunidad_id IS NULL THEN
      RAISE EXCEPTION 'LC_COT_SIN_OPORTUNIDAD: liga la cotización % a una oportunidad del CRM antes de aceptarla', COALESCE(v_folio, p_cotizacion_id::text)
        USING ERRCODE='P0001';
    END IF;
    IF v_cliente_id IS NULL AND NOT v_prospecto_sin_cliente THEN
      RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: la cotización % no tiene cliente; convierte el prospecto en cliente antes de aceptarla', COALESCE(v_folio, p_cotizacion_id::text)
        USING ERRCODE='P0001';
    END IF;
  END IF;

  IF v_prospecto_sin_cliente THEN
    -- Excepción acotada: mismo tenant activo, sesión y permisos ya validados.
    IF v_uid IS NULL OR v_org IS DISTINCT FROM public.org_scope()
       OR NOT public.is_org_member(v_org) OR NOT public.rls_tenant_scope_ok(v_org) THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: no puedes aceptar este prospecto en el tenant activo' USING ERRCODE='42501';
    END IF;
    IF NOT v_reintento_prospecto AND v_estado_actual IS DISTINCT FROM 'Enviada' THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: un prospecto sin cliente sólo puede aceptarse desde Enviada'
        USING ERRCODE='P0001', HINT='estados_permitidos=Enviada';
    END IF;

    -- No esperar CRM manteniendo una hermana bloqueada: la conversión original
    -- puede revincular esas hermanas. El caller reintenta esta RPC, sin escrituras.
    BEGIN
      SELECT * INTO v_op FROM public.crm_oportunidades
        WHERE id = v_oportunidad_id AND organization_id = v_org AND deleted_at IS NULL
        FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
      RAISE EXCEPTION 'LC_COTIZACION_EN_PROCESO: la oportunidad está en otra operación; vuelve a intentar la aceptación'
        USING ERRCODE='55P03';
    END;
    IF NOT FOUND OR v_op.cliente_id IS NOT NULL OR v_op.lead_id IS NULL THEN
      RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: el prospecto requiere oportunidad viva del tenant, sin cliente y con lead de origen'
        USING ERRCODE='P0001';
    END IF;
    SELECT * INTO v_etapa FROM public.crm_etapas_pipeline
      WHERE id = v_op.etapa_id AND organization_id = v_org AND deleted_at IS NULL
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la etapa de la oportunidad no existe en este tenant'
        USING ERRCODE='P0001';
    END IF;
    SELECT * INTO v_lead FROM public.crm_leads
      WHERE id = v_op.lead_id AND organization_id = v_org AND deleted_at IS NULL
      FOR UPDATE;
    IF NOT FOUND OR v_lead.cliente_convertido_id IS NOT NULL
       OR (v_lead.oportunidad_convertida_id IS NOT NULL AND v_lead.oportunidad_convertida_id <> v_op.id) THEN
      RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: el lead de origen no existe o tiene una conversión conflictiva'
        USING ERRCODE='P0001';
    END IF;
    IF v_op.moneda IS DISTINCT FROM v_moneda THEN
      RAISE EXCEPTION 'LC_MONEDA_INCOMPATIBLE: la cotización y la oportunidad tienen monedas distintas'
        USING ERRCODE='P0001';
    END IF;

    -- Valida vínculos REALES si existen; no exige ni inventa empresa histórica.
    FOR v_vinculo IN SELECT * FROM public.crm_oportunidad_empresa
      WHERE oportunidad_id = v_op.id FOR SHARE
    LOOP
      SELECT * INTO v_empresa FROM public.crm_empresas
        WHERE id = v_vinculo.empresa_id AND organization_id = v_org AND deleted_at IS NULL
        FOR SHARE;
      IF NOT FOUND OR v_vinculo.organization_id IS DISTINCT FROM v_org THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: una empresa vinculada no existe o es de otro tenant'
          USING ERRCODE='P0001';
      END IF;
    END LOOP;

    -- El otro linaje empresarial vigente es lead_origen_id; también es opcional.
    FOR v_empresa IN SELECT * FROM public.crm_empresas
      WHERE lead_origen_id = v_lead.id FOR SHARE
    LOOP
      IF v_empresa.organization_id IS DISTINCT FROM v_org OR v_empresa.deleted_at IS NOT NULL
         OR v_empresa.cliente_id IS NOT NULL THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la empresa de origen está eliminada, convertida o es de otro tenant'
          USING ERRCODE='P0001';
      END IF;
    END LOOP;

    IF v_op.cotizacion_ganadora_id IS NOT NULL AND v_op.cotizacion_ganadora_id <> p_cotizacion_id THEN
      RAISE EXCEPTION 'LC_COTIZACION_GANADORA_EXISTE: la oportunidad ya tiene una cotización ganadora'
        USING ERRCODE='P0001';
    END IF;
    IF v_etapa.tipo::text = 'perdida' THEN
      RAISE EXCEPTION 'LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA: reabre la oportunidad antes de aceptar una cotización'
        USING ERRCODE='P0001';
    END IF;

    IF v_reintento_prospecto THEN
      -- CRM ya ganó: no repetir los guards de etapa abierta ni lead calificado.
      IF v_op.cotizacion_ganadora_id IS DISTINCT FROM p_cotizacion_id
         OR v_etapa.tipo::text IS DISTINCT FROM 'ganada'
         OR v_version_aceptada IS DISTINCT FROM v_version
         OR v_aceptada_en IS NULL OR v_aceptada_por IS NULL THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: el reintento del prospecto requiere ganadora propia, etapa ganada y sello íntegro'
          USING ERRCODE='P0001';
      END IF;
    ELSE
      IF v_op.cotizacion_ganadora_id IS NOT NULL
         OR v_etapa.tipo::text IS DISTINCT FROM 'abierta' OR v_etapa.activa IS DISTINCT FROM true
         OR v_lead.estado::text NOT IN ('Calificado','Prospecto')
         OR v_version_aceptada IS NOT NULL OR v_aceptada_en IS NOT NULL OR v_aceptada_por IS NOT NULL THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: el prospecto enviado requiere oportunidad abierta sin ganadora y origen calificado'
          USING ERRCODE='P0001';
      END IF;
    END IF;
    v_requiere := true;
    v_origen := 'aceptacion_prospecto_crm';
  ELSE
    -- Cliente existente (incluido retry tras convertir): contrato original.
    v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
    v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;
  END IF;

  -- v13.823.58: reintento idempotente. El primer request pudo aceptar y la
  -- respuesta perderse en la red; con la fila ya bloqueada y la identidad,
  -- pertenencia y rol validados, devolvemos el mismo resultado sin reescribir
  -- nada (ni sello, ni valor_real, ni auditoría, ni notificación).
  IF v_estado_actual IN ('Aceptada','En operación') THEN
    IF v_oportunidad_id IS NOT NULL THEN
      SELECT true, o.cotizacion_ganadora_id
        INTO v_op_existe, v_ganadora
        FROM public.crm_oportunidades o
       WHERE o.id = v_oportunidad_id
         AND o.organization_id = v_org
         AND o.deleted_at IS NULL
       FOR UPDATE OF o;

      IF NOT COALESCE(v_op_existe, false) THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada pero su oportunidad no existe, está eliminada o es de otra organización (cotización %)', p_cotizacion_id
          USING ERRCODE='P0001';
      END IF;

      IF v_ganadora IS NULL THEN
        RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada pero la oportunidad no registra cotización ganadora (cotización %); revisión manual requerida', p_cotizacion_id
          USING ERRCODE='P0001';
      END IF;

      IF v_ganadora <> p_cotizacion_id THEN
        RAISE EXCEPTION 'LC_COTIZACION_GANADORA_EXISTE: la oportunidad ya tiene una cotización ganadora'
          USING ERRCODE='P0001',
                HINT=format('ganadora_actual=%s; intentada=%s', v_ganadora, p_cotizacion_id);
      END IF;
    END IF;

    IF v_version_aceptada IS NULL THEN
      RAISE EXCEPTION 'LC_COTIZACION_ACEPTACION_INCONSISTENTE: la cotización está aceptada sin versión aceptada sellada (cotización %); revisión manual requerida', p_cotizacion_id
        USING ERRCODE='P0001';
    END IF;

    RETURN jsonb_build_object(
      'cotizacion_id', p_cotizacion_id,
      'version_aceptada', v_version_aceptada,
      'origen_aceptacion', v_origen,
      'sin_cambios', true);
  END IF;

  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;

  IF v_requiere THEN
    IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %, estados_permitidos: [Borrador, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Enviada';
    END IF;
  ELSE
    IF v_estado_actual NOT IN ('Borrador','Solicitada','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Solicitada/Enviada (actual: %, estados_permitidos: [Borrador, Solicitada, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Solicitada,Enviada';
    END IF;
  END IF;

  -- v13.823.330 · Auditoría YAGNI #5: una cotización transaccional no puede
  -- aceptarse sin importe. Las informativas (tarifarios) quedan exentas porque
  -- no generan operación ni facturación.
  IF COALESCE(v_tipo_documento, 'transaccional') <> 'informativa' THEN
    SELECT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(v_conceptos, '[]'::jsonb)) = 'array'
                    THEN v_conceptos ELSE '[]'::jsonb END) c
       WHERE COALESCE(NULLIF(c->>'cantidad', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
         AND COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
         AND (c->>'cantidad')::numeric > 0
         AND (c->>'precio_unitario')::numeric > 0
    ) INTO v_renglon_valido;

    IF COALESCE(v_subtotal, 0) <= 0 OR NOT COALESCE(v_renglon_valido, false) THEN
      RAISE EXCEPTION 'LC_COT_IMPORTE_REQUERIDO: la cotización % no tiene importe; captura al menos un concepto con cantidad y precio mayores a cero antes de aceptarla', COALESCE(v_folio, p_cotizacion_id::text)
        USING ERRCODE='P0001';
    END IF;
  END IF;



  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual,'origen_aceptacion',v_origen));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version,
                            'origen_aceptacion',v_origen,'sin_cambios',false);
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO authenticated, service_role;
