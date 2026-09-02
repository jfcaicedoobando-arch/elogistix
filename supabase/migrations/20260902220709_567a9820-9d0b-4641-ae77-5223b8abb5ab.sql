-- v13.823.58 · Microcorrección forward-only del lote de ganadora.
-- Preflight read-only: 0 filas afectadas por el sello del backfill legacy
-- (ninguna cotización terminal viva con version_aceptada/aceptada_en faltante
-- o distinta del último snapshot). No se inventa DML sobre datos vivos.

-- ── 1) Reintento realmente idempotente en aceptar_cotizacion_version ───────
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
BEGIN
  -- v13.823.57: lock de la fila ANTES de validar; dos aceptaciones simultáneas
  -- se serializan y la segunda ve el estado ya terminal.
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id,
         created_by, oportunidad_id, version_aceptada
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id,
         v_creado_por, v_oportunidad_id, v_version_aceptada
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

-- ── 2) Sello coherente con el snapshot en el backfill legacy ───────────────
-- La rutina de v13.823.57 eligió el snapshot MÁS RECIENTE para el monto cuando
-- `version_aceptada` era NULL, pero luego selló `version_aceptada = version`
-- (la versión viva): eso etiqueta una foto con el número de otra. Aquí se
-- corrige el sello usando `version_num`/`created_at` del snapshot elegido.
-- Nunca se usa el subtotal vivo. Idempotente y seguro en replay.
DO $bf$
DECLARE
  r record;
  v_snap record;
  v_filas int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT
           b.organization_id,
           b.entidad_id AS op_id,
           (b.detalles -> 'after' ->> 'cotizacion_ganadora_id')::uuid AS cot_id
      FROM public.bitacora_actividad b
     WHERE b.accion = 'oportunidad_ganada_backfill'
       AND b.detalles ->> 'fuente_monto' = 'snapshot_mas_reciente'
       AND (b.detalles -> 'after' ->> 'cotizacion_ganadora_id') IS NOT NULL
  LOOP
    SELECT v.version_num, v.created_at
      INTO v_snap
      FROM public.cotizacion_versiones v
     WHERE v.cotizacion_id = r.cot_id
     ORDER BY v.version_num DESC
     LIMIT 1;

    CONTINUE WHEN v_snap.version_num IS NULL;

    UPDATE public.cotizaciones c
       SET version_aceptada = v_snap.version_num,
           aceptada_en = v_snap.created_at,
           updated_at = now()
     WHERE c.id = r.cot_id
       AND c.organization_id = r.organization_id
       -- sólo si el sello vigente proviene de la versión viva (incoherente)
       AND c.version_aceptada = c.version
       AND c.version_aceptada IS DISTINCT FROM v_snap.version_num;

    IF FOUND THEN
      v_filas := v_filas + 1;
      INSERT INTO public.bitacora_actividad (
        organization_id, modulo, accion, entidad_id, entidad_nombre,
        usuario_id, usuario_email, detalles
      ) VALUES (
        r.organization_id, 'crm', 'oportunidad_ganada_backfill_sello_corregido',
        r.op_id, '', NULL, '',
        jsonb_build_object('cotizacion_id', r.cot_id,
                           'version_aceptada', v_snap.version_num,
                           'aceptada_en', v_snap.created_at,
                           'fuente', 'snapshot_mas_reciente')
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'v13.823.58 backfill sello coherente: % filas corregidas', v_filas;
END
$bf$;