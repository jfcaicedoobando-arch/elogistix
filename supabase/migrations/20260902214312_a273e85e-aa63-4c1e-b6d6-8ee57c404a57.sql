-- v13.823.57 · Autoridad única transaccional: cotización terminal → oportunidad ganada.
-- Preflight read-only previo: 0 duplicados, 0 cross-org/huérfanas, 0 ganadores
-- inconsistentes; único candidato de backfill 9a86e355-16bd-4acc-b37f-2fa1a3022ce1
-- (valor_real histórico 1798.48, se conserva).

-- ── 1) Retirar los tres triggers competidores (orden alfabético no determinista) ──
DROP TRIGGER IF EXISTS trg_cotizacion_acepta_oportunidad ON public.cotizaciones;
DROP TRIGGER IF EXISTS trg_cotizacion_cierra_oportunidad ON public.cotizaciones;
DROP TRIGGER IF EXISTS trg_crm_set_valor_real_on_aceptada ON public.cotizaciones;
DROP FUNCTION IF EXISTS public.crm_marcar_oportunidad_ganada();
DROP FUNCTION IF EXISTS public.crm_cierra_oportunidad_desde_cotizacion();
DROP FUNCTION IF EXISTS public.crm_set_valor_real_on_aceptada();

-- ── 2) Autoridad única ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_terminales estado_cotizacion[] := ARRAY['Aceptada'::estado_cotizacion,
                                            'En operación'::estado_cotizacion];
  v_es_terminal  boolean;
  v_era_terminal boolean;
  v_op_id uuid; v_op_org uuid; v_op_vendedor uuid; v_op_nombre text;
  v_etapa_tipo crm_etapa_tipo; v_etapa_ganada uuid;
  v_ganadora uuid; v_valor_previo numeric; v_emb_ganador uuid;
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_uid uuid := auth.uid();
BEGIN
  -- (j) La cotización ganadora no migra de oportunidad ni de organización.
  IF TG_OP = 'UPDATE'
     AND (NEW.oportunidad_id IS DISTINCT FROM OLD.oportunidad_id
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id)
     AND EXISTS (
       SELECT 1 FROM public.crm_oportunidades o
        WHERE o.cotizacion_ganadora_id = OLD.id
          AND o.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'LC_COTIZACION_GANADORA_INMUTABLE: la cotización ganadora no puede cambiar de oportunidad ni de organización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (i) Papelera: se conserva cotizacion_ganadora_id, valor_real y snapshot.
  -- Sólo se libera embarque_ganador_id si ese embarque ya no está vivo.
  IF NEW.deleted_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
      UPDATE public.crm_oportunidades o
         SET embarque_ganador_id = NULL, updated_at = now()
       WHERE o.cotizacion_ganadora_id = NEW.id
         AND o.organization_id = NEW.organization_id
         AND o.deleted_at IS NULL
         AND o.embarque_ganador_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.embarques e
            WHERE e.id = o.embarque_ganador_id AND e.deleted_at IS NULL
         );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.oportunidad_id IS NULL THEN RETURN NEW; END IF;

  v_es_terminal := NEW.estado = ANY (v_terminales);
  IF NOT v_es_terminal THEN RETURN NEW; END IF;
  v_era_terminal := TG_OP = 'UPDATE'
                    AND OLD.deleted_at IS NULL
                    AND OLD.estado = ANY (v_terminales);

  -- (b) lock de la oportunidad: serializa aceptaciones concurrentes.
  SELECT o.id, o.organization_id, o.vendedor_id, o.nombre, e.tipo,
         o.cotizacion_ganadora_id, o.valor_real, o.embarque_ganador_id
    INTO v_op_id, v_op_org, v_op_vendedor, v_op_nombre, v_etapa_tipo,
         v_ganadora, v_valor_previo, v_emb_ganador
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
   FOR UPDATE OF o;

  -- (a) cross-org / inexistente / eliminada
  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (c) un único ganador por oportunidad
  IF v_ganadora IS NOT NULL AND v_ganadora <> NEW.id THEN
    RAISE EXCEPTION 'LC_COTIZACION_GANADORA_EXISTE: la oportunidad ya tiene una cotización ganadora'
      USING ERRCODE = 'P0001',
            HINT = format('ganadora_actual=%s; intentada=%s (%s)',
                          v_ganadora, NEW.id, COALESCE(NEW.folio, 'sin folio'));
  END IF;

  -- (h) una oportunidad perdida exige reapertura explícita
  IF v_etapa_tipo = 'perdida'::crm_etapa_tipo THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA: reabre la oportunidad antes de aceptar una cotización'
      USING ERRCODE = 'P0001';
  END IF;

  -- (d) sellado sólo en la primera transición no-terminal → terminal
  IF NOT v_era_terminal THEN
    NEW.version_aceptada := NEW.version;
    NEW.aceptada_en := now();
    NEW.aceptada_por := COALESCE(v_uid, NEW.aceptada_por);
  END IF;

  SELECT id INTO v_etapa_ganada
    FROM public.crm_etapas_pipeline
   WHERE organization_id = v_op_org
     AND tipo = 'ganada'::crm_etapa_tipo
     AND activa = true
     AND deleted_at IS NULL
   ORDER BY orden ASC
   LIMIT 1;
  IF v_etapa_ganada IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_SIN_ETAPA_GANADA: configura una etapa ganada activa en el pipeline antes de aceptar cotizaciones'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_etapa_tipo = 'abierta'::crm_etapa_tipo THEN
    -- (e) primer cierre abierta → ganada
    UPDATE public.crm_oportunidades
       SET etapa_id = v_etapa_ganada,
           probabilidad = 100,
           fecha_cierre_real = v_hoy,
           valor_real = NEW.subtotal,
           cotizacion_ganadora_id = NEW.id,
           embarque_ganador_id = COALESCE(NEW.embarque_id, embarque_ganador_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_auto', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'embarque_id', NEW.embarque_id, 'monto', NEW.subtotal,
                         'version_aceptada', NEW.version)
    );

    IF v_op_vendedor IS NOT NULL THEN
      INSERT INTO public.crm_notificaciones (
        organization_id, user_id, tipo, titulo, mensaje, link
      ) VALUES (
        v_op_org, v_op_vendedor, 'oportunidad_ganada', '¡Oportunidad ganada!',
        '“' || COALESCE(v_op_nombre, 'Oportunidad') || '” se cerró con la cotización '
          || COALESCE(NEW.folio, ''),
        '/crm/oportunidades/' || v_op_id::text
      );
    END IF;

  ELSIF v_ganadora IS NULL THEN
    -- Etapa ya ganada sin ganador registrado: enlaza sin tocar el monto histórico.
    UPDATE public.crm_oportunidades
       SET cotizacion_ganadora_id = NEW.id,
           valor_real = COALESCE(valor_real, NEW.subtotal),
           embarque_ganador_id = COALESCE(embarque_ganador_id, NEW.embarque_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_vinculada', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'valor_real_conservado', v_valor_previo)
    );

  ELSIF NOT v_era_terminal THEN
    -- (g) la misma ganadora se recotizó y se vuelve a aceptar: nuevo valor,
    -- auditoría explícita del cambio, sin duplicar la notificación.
    UPDATE public.crm_oportunidades
       SET valor_real = NEW.subtotal,
           embarque_ganador_id = COALESCE(embarque_ganador_id, NEW.embarque_id),
           updated_at = now()
     WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_revalorada', v_op_id, COALESCE(v_op_nombre, ''),
      COALESCE(v_uid, v_op_vendedor), COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object('cotizacion_id', NEW.id, 'cotizacion_folio', NEW.folio,
                         'valor_previo', v_valor_previo, 'valor_nuevo', NEW.subtotal,
                         'version_aceptada', NEW.version)
    );

  ELSE
    -- (f) reintento idempotente / Aceptada → En operación: sólo embarque.
    IF NEW.embarque_id IS NOT NULL AND v_emb_ganador IS NULL THEN
      UPDATE public.crm_oportunidades
         SET embarque_ganador_id = NEW.embarque_id, updated_at = now()
       WHERE id = v_op_id AND organization_id = v_op_org AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() FROM PUBLIC;

-- Nombre `zz_` deliberado: corre al final de los triggers BEFORE, después del
-- cálculo de subtotal y de los guards de estado/SoD/inmutabilidad.
DROP TRIGGER IF EXISTS zz_crm_cerrar_oportunidad_desde_cotizacion ON public.cotizaciones;
CREATE TRIGGER zz_crm_cerrar_oportunidad_desde_cotizacion
BEFORE INSERT OR UPDATE OF estado, embarque_id, oportunidad_id, organization_id, deleted_at
ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion();

-- ── 3) Respaldo de concurrencia ────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_cotizaciones_ganadora_viva_por_oportunidad
ON public.cotizaciones (organization_id, oportunidad_id)
WHERE deleted_at IS NULL
  AND oportunidad_id IS NOT NULL
  AND estado IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion);

-- ── 4) Backfill histórico determinista e idempotente ───────────────────────
DO $bf$
DECLARE
  r record;
  v_cot record;
  v_snap numeric;
  v_fuente text;
BEGIN
  FOR r IN
    SELECT o.id, o.organization_id, o.nombre, o.valor_real, o.vendedor_id,
           o.embarque_ganador_id
      FROM public.crm_oportunidades o
     WHERE o.deleted_at IS NULL
       AND o.cotizacion_ganadora_id IS NULL
       AND (SELECT count(*) FROM public.cotizaciones c
             WHERE c.deleted_at IS NULL
               AND c.oportunidad_id = o.id
               AND c.organization_id = o.organization_id
               AND c.estado IN ('Aceptada'::estado_cotizacion,
                                'En operación'::estado_cotizacion)) = 1
     FOR UPDATE
  LOOP
    SELECT c.* INTO v_cot
      FROM public.cotizaciones c
     WHERE c.deleted_at IS NULL
       AND c.oportunidad_id = r.id
       AND c.organization_id = r.organization_id
       AND c.estado IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion)
     FOR UPDATE;

    IF r.valor_real IS NOT NULL THEN
      v_snap := r.valor_real;
      v_fuente := 'valor_real_existente';
    ELSE
      SELECT (v.snapshot ->> 'subtotal')::numeric INTO v_snap
        FROM public.cotizacion_versiones v
       WHERE v.cotizacion_id = v_cot.id
         AND (v_cot.version_aceptada IS NULL OR v.version_num = v_cot.version_aceptada)
       ORDER BY v.version_num DESC
       LIMIT 1;
      v_fuente := CASE WHEN v_cot.version_aceptada IS NULL
                       THEN 'snapshot_mas_reciente' ELSE 'snapshot_version_aceptada' END;
      IF v_snap IS NULL THEN
        RAISE EXCEPTION 'LC_BACKFILL_SIN_MONTO_CONFIABLE: oportunidad % sin valor_real ni snapshot (cotización %); no se usa el subtotal vivo',
          r.id, v_cot.id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    UPDATE public.crm_oportunidades
       SET cotizacion_ganadora_id = v_cot.id,
           valor_real = v_snap,
           embarque_ganador_id = COALESCE(embarque_ganador_id, v_cot.embarque_id),
           updated_at = now()
     WHERE id = r.id AND organization_id = r.organization_id;

    -- Sellado determinista de metadatos faltantes (sin inventar usuario).
    UPDATE public.cotizaciones
       SET version_aceptada = COALESCE(version_aceptada, version),
           aceptada_en = COALESCE(aceptada_en, updated_at)
     WHERE id = v_cot.id
       AND (version_aceptada IS NULL OR aceptada_en IS NULL);

    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      r.organization_id, 'crm', 'oportunidad_ganada_backfill', r.id, COALESCE(r.nombre, ''),
      r.vendedor_id, '',
      jsonb_build_object(
        'before', jsonb_build_object('cotizacion_ganadora_id', NULL,
                                     'valor_real', r.valor_real,
                                     'embarque_ganador_id', r.embarque_ganador_id),
        'after', jsonb_build_object('cotizacion_ganadora_id', v_cot.id,
                                    'valor_real', v_snap,
                                    'embarque_ganador_id',
                                    COALESCE(r.embarque_ganador_id, v_cot.embarque_id)),
        'fuente_monto', v_fuente,
        'cotizacion_folio', v_cot.folio)
    );
  END LOOP;
END
$bf$;

-- ── 5) Cerrar otros caminos ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._crm_sync_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $sync$
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Sólo oportunidades vivas, ABIERTAS y de la misma organización: una
  -- cotización alternativa/Borrador no puede mover una ganada o perdida.
  UPDATE public.crm_oportunidades o
     SET monto_estimado = COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado),
         moneda         = COALESCE(NEW.moneda::text, o.moneda),
         cliente_id     = COALESCE(o.cliente_id, NEW.cliente_id),
         updated_at     = now()
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.crm_etapas_pipeline e
        WHERE e.id = o.etapa_id
          AND e.tipo = 'abierta'::crm_etapa_tipo
          AND e.deleted_at IS NULL
     )
     AND (
       COALESCE(o.monto_estimado, 0) <> COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado, 0)
       OR COALESCE(o.moneda, '') <> COALESCE(NEW.moneda::text, o.moneda, '')
       OR (o.cliente_id IS NULL AND NEW.cliente_id IS NOT NULL)
     );
  RETURN NEW;
END;
$sync$;

REVOKE ALL ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() FROM PUBLIC;

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
BEGIN
  -- v13.823.57: lock de la fila ANTES de validar; dos aceptaciones simultáneas
  -- se serializan y la segunda ve el estado ya terminal.
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id, created_by
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id, v_creado_por
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

  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;

  v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
  v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;

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
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version,'origen_aceptacion',v_origen);
END;
$$;