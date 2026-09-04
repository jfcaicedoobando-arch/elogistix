-- Fuente canónica. Espejo 1:1 de la migración v13.823.57.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
  v_ganadora uuid; v_valor_previo numeric; v_emb_ganador uuid; v_op_moneda text;
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
         o.cotizacion_ganadora_id, o.valor_real, o.embarque_ganador_id, o.moneda
    INTO v_op_id, v_op_org, v_op_vendedor, v_op_nombre, v_etapa_tipo,
         v_ganadora, v_valor_previo, v_emb_ganador, v_op_moneda
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

  -- (k) no se escribe valor_real de una cotización en otra moneda distinta
  -- a la de la oportunidad: evita mezclar, p. ej., subtotal USD dentro de
  -- una oportunidad MXN.
  IF v_op_moneda IS NOT NULL AND NEW.moneda::text IS DISTINCT FROM v_op_moneda THEN
    RAISE EXCEPTION 'LC_MONEDA_INCOMPATIBLE: la cotización está en % y la oportunidad en %; actualiza la moneda de la oportunidad o cotiza en la misma moneda antes de aceptarla',
      NEW.moneda, v_op_moneda
      USING ERRCODE = 'P0001';
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
