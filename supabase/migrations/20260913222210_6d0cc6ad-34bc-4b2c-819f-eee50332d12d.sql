-- v13.823.355 · YAGNI r2 (lote 2): guardas de aceptación de prospectos,
-- revalidación de cotizaciones eliminadas y aislamiento de agente por empresa.

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
BEGIN
  -- v13.823.57: lock de la fila ANTES de validar; dos aceptaciones simultáneas
  -- se serializan y la segunda ve el estado ya terminal.
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id,
         created_by, oportunidad_id, version_aceptada,
         tipo_documento, subtotal, conceptos_venta, es_prospecto
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id,
         v_creado_por, v_oportunidad_id, v_version_aceptada,
         v_tipo_documento, v_subtotal, v_conceptos, v_es_prospecto
    FROM cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;

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

  v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
  v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;

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

  -- v13.823.355 (YAGNI r2 · P1): aceptar un prospecto sin oportunidad ligada
  -- dejaba la cotización en un callejón sin salida (sin cliente, sin conversión,
  -- sin embarque y sin edición). Se exige el vínculo CRM antes de aceptar.
  IF COALESCE(v_es_prospecto, false) AND v_oportunidad_id IS NULL THEN
    RAISE EXCEPTION 'LC_COT_SIN_OPORTUNIDAD: liga la cotización a una oportunidad del CRM antes de aceptarla'
      USING ERRCODE='P0001';
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


CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot             public.cotizaciones%ROWTYPE;
  v_caller_org      UUID := current_user_org_id();
  v_is_super        BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_umbral_pct      NUMERIC;
  v_bloquea_vencida BOOLEAN;
  v_tarifa_vigente  BOOLEAN := FALSE;
  v_tarifa_vig_rec  RECORD;
  v_cambios         JSONB := '[]'::jsonb;
  v_max_delta_pct   NUMERIC := 0;
  v_severidad       TEXT;
  v_costo           RECORD;
  v_monto_actual    NUMERIC;
  v_delta_abs       NUMERIC;
  v_delta_pct       NUMERIC;
  v_reaprob_vigente BOOLEAN := FALSE;
  v_snapshot        JSONB;
  v_snapshot_aprob  JSONB;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  -- v13.823.355 (YAGNI r2 · P1): una cotización eliminada no se revalida ni por
  -- RPC directa; antes seguía leyendo tarifas y devolviendo severidad.
  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_ELIMINADA: la cotización está eliminada' USING ERRCODE='P0001';
  END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT COALESCE((valor#>>'{}')::numeric,5) INTO v_umbral_pct
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_umbral_pct';
  v_umbral_pct := COALESCE(v_umbral_pct,5);
  SELECT COALESCE((valor#>>'{}')::boolean,TRUE) INTO v_bloquea_vencida
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_bloquea_si_vencida';
  v_bloquea_vencida := COALESCE(v_bloquea_vencida,TRUE);
  IF v_cot.tarifa_id IS NULL THEN
    RETURN jsonb_build_object(
      'tarifa_vigente',TRUE,'agente_sin_cupo',FALSE,'severidad','sin_cambios',
      'cambios','[]'::jsonb,'umbral_pct',v_umbral_pct,'max_delta_pct',0,
      'estado_revalidacion',v_cot.estado_revalidacion,'reaprobacion_vigente',FALSE,
      'motivo','sin_tarifa_vinculada');
  END IF;
  -- v13.823.351: la tarifa vigente y sus recargos se leen acotados a la
  -- organización de la cotización (las FK son sólo por UUID).
  SELECT * INTO v_tarifa_vig_rec FROM public.costeo_tarifas_vigentes_v
   WHERE id=v_cot.tarifa_id AND organization_id=v_cot.organization_id LIMIT 1;
  v_tarifa_vigente := FOUND;
  FOR v_costo IN
    SELECT cc.concepto, cc.moneda, cc.costo_unitario AS monto_anterior,
           cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id
    FROM public.cotizacion_costos cc
    WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
      AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      SELECT monto INTO v_monto_actual FROM public.costeo_tarifa_recargos
       WHERE id=v_costo.costeo_tarifa_recargo_id AND organization_id=v_cot.organization_id;
    ELSE
      SELECT flete_base INTO v_monto_actual FROM public.costeo_tarifas
       WHERE id=v_costo.costeo_tarifa_id AND organization_id=v_cot.organization_id;
    END IF;
    IF v_monto_actual IS NULL THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',NULL,
        'delta_abs',NULL,'delta_pct',NULL,'motivo','eliminado');
      v_max_delta_pct := 100;
      CONTINUE;
    END IF;
    v_delta_abs := v_monto_actual - v_costo.monto_anterior;
    v_delta_pct := CASE WHEN v_costo.monto_anterior=0
                     THEN CASE WHEN v_delta_abs=0 THEN 0 ELSE 100 END
                     ELSE ROUND(ABS(v_delta_abs)/v_costo.monto_anterior*100,2) END;
    IF ABS(v_delta_abs) > 0.001 THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',v_monto_actual,
        'delta_abs',v_delta_abs,'delta_pct',v_delta_pct);
      IF v_delta_pct > v_max_delta_pct THEN v_max_delta_pct := v_delta_pct; END IF;
    END IF;
  END LOOP;

  -- Huella económica canónica: identifica cada costo fuente y su importe
  -- vigente. A diferencia del máximo porcentual, detecta cualquier cambio de
  -- composición o importe aunque el porcentaje agregado coincida.
  SELECT jsonb_build_object(
    'tarifa_vigente', v_tarifa_vigente,
    'filas', COALESCE(jsonb_agg(jsonb_build_object(
      'cotizacion_costo_id', cc.id,
      'tarifa_id', cc.costeo_tarifa_id,
      'recargo_id', cc.costeo_tarifa_recargo_id,
      'cantidad', cc.cantidad,
      'moneda', cc.moneda,
      'monto_actual', CASE WHEN cc.costeo_tarifa_recargo_id IS NOT NULL THEN r.monto ELSE t.flete_base END
    ) ORDER BY cc.id), '[]'::jsonb)
  ) INTO v_snapshot
  FROM public.cotizacion_costos cc
  LEFT JOIN public.costeo_tarifa_recargos r
         ON r.id=cc.costeo_tarifa_recargo_id AND r.organization_id=v_cot.organization_id
  LEFT JOIN public.costeo_tarifas t
         ON t.id=cc.costeo_tarifa_id AND t.organization_id=v_cot.organization_id
  WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
    AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL);
  IF NOT v_tarifa_vigente AND v_bloquea_vencida THEN v_severidad := 'bloqueante';
  ELSIF jsonb_array_length(v_cambios)=0 AND v_tarifa_vigente THEN v_severidad := 'sin_cambios';
  ELSIF v_max_delta_pct > v_umbral_pct THEN v_severidad := 'bloqueante';
  ELSE v_severidad := 'informativa';
  END IF;

  -- R201-COT-02: la re-aprobación de ventas consume el bloqueo, pero SÓLO si
  -- corresponde al mismo delta que ventas autorizó.
  IF v_severidad = 'bloqueante' AND v_cot.estado_revalidacion = 'reaprobada' THEN
    v_snapshot_aprob := v_cot.revalidacion_delta_jsonb->'snapshot_economico';
    IF v_snapshot_aprob IS NOT NULL AND v_snapshot_aprob = v_snapshot THEN
      v_severidad := 'informativa';
      v_reaprob_vigente := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'estado_revalidacion',v_cot.estado_revalidacion,
    'reaprobacion_vigente',v_reaprob_vigente,
    'snapshot_economico',v_snapshot,
    'motivo',CASE WHEN v_reaprob_vigente THEN 'reaprobada_por_ventas' ELSE NULL END,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$function$;

REVOKE ALL ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(p_cotizacion_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot           public.cotizaciones%ROWTYPE;
  v_caller_org    uuid := current_user_org_id();
  v_is_super      boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_can_write     boolean;
  v_embarque_id   uuid;
  v_orphan_id     uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_target_ids    uuid[];
  v_cid           uuid;

  v_origen_code   text;
  v_destino_code  text;
  v_puerto_o      text;
  v_puerto_d      text;
  v_aero_o        text;
  v_aero_d        text;
  v_ciudad_o      text;
  v_ciudad_d      text;
  v_tipo_cont_code text;
  v_agente_id     uuid;
  v_naviera_id    uuid;
  v_agente_nombre text;
  v_naviera_nombre text;
  v_tipo_servicio text;
  v_monedas       integer;
  v_es_fcl        boolean;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización % no existe', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización % está eliminada', p_cotizacion_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin_org'::app_role)
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'gerente_operaciones'::app_role)
                 OR has_role(auth.uid(), 'coordinador_logistico'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo administración u operación pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.330 · Auditoría YAGNI #2: una cotización con dinero en más de una
  -- moneda no puede convertirse sin tipo de cambio sellado; convertir con TC
  -- implícito (o 1:1) deformaría el P&L del embarque.
  SELECT count(DISTINCT upper(btrim(COALESCE(c->>'moneda', 'MXN'))))
    INTO v_monedas
    FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(COALESCE(v_cot.conceptos_venta, '[]'::jsonb)) = 'array'
                THEN v_cot.conceptos_venta ELSE '[]'::jsonb END) c
   -- v13.823.347: el importe efectivo cae a cantidad x precio cuando el
   -- renglón legacy trae `total` nulo o 0; antes esas filas USD no contaban y
   -- una cotización mixta se convertía sin tipo de cambio.
   WHERE COALESCE(
           NULLIF(
             CASE WHEN COALESCE(NULLIF(c->>'total', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  THEN (c->>'total')::numeric ELSE 0 END, 0),
           CASE WHEN COALESCE(NULLIF(c->>'cantidad', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 AND COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'cantidad')::numeric * (c->>'precio_unitario')::numeric
                ELSE 0 END
         ) <> 0;

  IF COALESCE(v_monedas, 0) > 1 AND COALESCE(v_cot.tipo_cambio_usd, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_COT_TC_REQUERIDO: la cotización % tiene importes en más de una moneda y no tiene tipo de cambio; captúralo antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  -- v13.823.330 · Auditoría YAGNI #4: FCL exige número de contenedores real.
  -- Antes `GREATEST(1, ...)` convertía 0 en 1 en silencio. LCL no cambia.
  v_es_fcl := v_cot.modo = 'Marítimo'::modo_transporte
    AND upper(btrim(COALESCE(NULLIF(btrim(v_cot.tipo_embarque), ''), v_cot.tipo_carga, ''))) = 'FCL';
  IF v_es_fcl AND COALESCE(v_cot.num_contenedores, 0) < 1 THEN
    RAISE EXCEPTION 'LC_COT_CONTENEDORES_REQUERIDOS: la cotización % es marítima FCL y no indica cuántos contenedores; captura el número de contenedores (1 o más) antes de crear el embarque', COALESCE(v_cot.folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.embarque_id IS NOT NULL THEN
    SELECT id INTO v_orphan_id FROM public.embarques WHERE id = v_cot.embarque_id AND deleted_at IS NULL;
    IF FOUND THEN
      RETURN v_orphan_id;
    END IF;
    UPDATE public.cotizaciones SET embarque_id = NULL WHERE id = v_cot.id;
  END IF;

  SELECT id INTO v_orphan_id
  FROM public.embarques
  WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_orphan_id IS NOT NULL THEN
    RETURN v_orphan_id;
  END IF;

  v_origen_code := COALESCE(
    NULLIF(substring(v_cot.origen  FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.origen),  ''),
    NULL
  );
  v_destino_code := COALESCE(
    NULLIF(substring(v_cot.destino FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.destino), ''),
    NULL
  );

  IF v_origen_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_o FROM public.puertos p WHERE p.code = v_origen_code LIMIT 1;
  END IF;
  IF v_destino_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_d FROM public.puertos p WHERE p.code = v_destino_code LIMIT 1;
  END IF;

  IF v_cot.modo = 'Aéreo'::modo_transporte THEN
    v_aero_o := COALESCE(v_puerto_o, v_origen_code);
    v_aero_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSIF v_cot.modo = 'Terrestre'::modo_transporte THEN
    v_ciudad_o := COALESCE(v_puerto_o, v_origen_code);
    v_ciudad_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSE
    v_puerto_o := COALESCE(v_puerto_o, v_origen_code);
    v_puerto_d := COALESCE(v_puerto_d, v_destino_code);
  END IF;

  -- v13.320.4: usar columna real cotizaciones.tipo_contenedor (text).
  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_tipo_cont_code IS NOT NULL AND v_tipo_cont_code ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;

  -- SMOKE-02 (R216-COT-01): sembrar el servicio marítimo (FCL/LCL) desde
  -- `tipo_embarque` (con respaldo en `tipo_carga`).
  IF v_cot.modo = 'Marítimo'::modo_transporte THEN
    v_tipo_servicio := upper(btrim(COALESCE(NULLIF(btrim(v_cot.tipo_embarque), ''), v_cot.tipo_carga, '')));
    IF v_tipo_servicio NOT IN ('FCL', 'LCL') THEN
      v_tipo_servicio := NULL;
    END IF;
  ELSE
    v_tipo_servicio := NULL;
  END IF;

  v_agente_id  := v_cot.agente_id;
  v_naviera_id := v_cot.naviera_id;
  IF (v_agente_id IS NULL OR v_naviera_id IS NULL) AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT COALESCE(v_agente_id, t.agente_id), COALESCE(v_naviera_id, t.naviera_id)
      INTO v_agente_id, v_naviera_id
    -- v13.823.351: la tarifa se lee SIEMPRE acotada a la organización de la
    -- cotización; un id de otro tenant no debe sembrar agente/naviera.
    FROM public.costeo_tarifas t
     WHERE t.id = v_cot.tarifa_id AND t.organization_id = v_cot.organization_id;
  END IF;

  -- v13.823.355 (YAGNI r2 · P1): el agente se lee acotado a la organización de
  -- la cotización. Una referencia cruzada copiaba el nombre del agente de otro
  -- tenant al embarque; ahora falla cerrado.
  IF v_agente_id IS NOT NULL THEN
    SELECT nombre INTO v_agente_nombre
      FROM public.costeo_agentes
     WHERE id = v_agente_id AND organization_id = v_cot.organization_id;
    IF v_agente_nombre IS NULL THEN
      RAISE EXCEPTION 'LC_AGENTE_ORG_INVALIDA: el agente % no pertenece a la organización de la cotización', v_agente_id
        USING ERRCODE='P0001';
    END IF;
  END IF;
  IF v_naviera_id IS NOT NULL THEN SELECT name   INTO v_naviera_nombre FROM public.navieras       WHERE id = v_naviera_id; END IF;

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    msds_archivo,
    organization_id,
    puerto_origen, puerto_destino,
    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera,
    tipo_servicio,
    tipo_cambio_usd
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    v_cot.msds_archivo,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_aero_o, v_aero_d,
    v_ciudad_o, v_ciudad_d,
    v_cot.tarifa_id, v_cot.tarifa_id, v_cot.tarifa_id,
    v_cot.carta_garantia, v_cot.dias_libres_destino,
    v_cot.seguro, v_cot.valor_seguro_usd,
    v_agente_id, v_naviera_id, v_agente_nombre, v_naviera_nombre,
    v_tipo_servicio::tipo_servicio_maritimo,
    NULLIF(GREATEST(COALESCE(v_cot.tipo_cambio_usd, 0), 0), 0)
  )
  RETURNING id INTO v_embarque_id;

  -- v13.823.332 · BL-EMB-02: los contenedores hijos SÓLO existen en marítimo.
  v_target_ids := ARRAY[]::uuid[];
  IF v_cot.modo = 'Marítimo'::modo_transporte THEN
    IF v_tipo_servicio = 'LCL' THEN
      v_num := 1;
    ELSE
      v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
    END IF;
    v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
    v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
    v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
    v_piezas_rest := COALESCE(v_cot.piezas, 0);

    FOR i IN 1..v_num LOOP
      IF i = v_num THEN v_piezas_este := v_piezas_rest;
      ELSE v_piezas_este := v_piezas_base; END IF;
      v_piezas_rest := v_piezas_rest - v_piezas_este;

      INSERT INTO public.embarque_contenedores (
        embarque_id, numero_contenedor, tipo_contenedor, bl_house,
        peso_kg, volumen_m3, piezas, orden
      )
      VALUES (
        v_embarque_id, '',
        CASE WHEN v_tipo_servicio = 'LCL' THEN 'LCL' ELSE COALESCE(v_tipo_cont_code, '') END,
        '',
        v_peso_each, v_vol_each, v_piezas_este, i
      )
      RETURNING id INTO v_cid;

      v_target_ids := array_append(v_target_ids, v_cid);
      IF i = 1 THEN v_first_hijo_id := v_cid; END IF;
    END LOOP;
  END IF;

  PERFORM public._crear_embarque_replicar_conceptos(
    v_cot.id, v_embarque_id, v_cot.organization_id, v_target_ids, v_cot.conceptos_venta
  );

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, estado = 'En operación'::estado_cotizacion, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES (v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
          'Cotizaciones', 'Borrador de embarque creado', v_cot.id, v_cot.folio,
          jsonb_build_object('embarque_id', v_embarque_id, 'expediente', NULL));

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace)
  SELECT v_cot.organization_id, om.user_id, 'cotizacion_borrador_embarque',
         'Borrador de embarque creado',
         'Se generó un borrador de embarque desde la cotización ' || v_cot.folio,
         '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role,
                    'gerente_operaciones'::app_role, 'coordinador_logistico'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO service_role;