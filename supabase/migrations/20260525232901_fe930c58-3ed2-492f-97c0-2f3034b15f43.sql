-- 1) Nuevas columnas opcionales en crm_oportunidades
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS cotizacion_ganadora_id uuid,
  ADD COLUMN IF NOT EXISTS embarque_ganador_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_cot_ganadora
  ON public.crm_oportunidades(cotizacion_ganadora_id)
  WHERE cotizacion_ganadora_id IS NOT NULL;

-- 2) Trigger que cierra la oportunidad cuando su cotización se acepta
CREATE OR REPLACE FUNCTION public.crm_cierra_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id uuid;
  v_op_org uuid;
  v_op_vendedor uuid;
  v_op_nombre text;
  v_etapa_actual_tipo crm_etapa_tipo;
  v_etapa_ganada_id uuid;
BEGIN
  -- Sólo nos interesa cuando la cotización entra a Aceptada o En operación
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.estado = NEW.estado
     AND COALESCE(OLD.embarque_id::text, '') = COALESCE(NEW.embarque_id::text, '') THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.organization_id, o.vendedor_id, o.nombre, e.tipo
    INTO v_op_id, v_op_org, v_op_vendedor, v_op_nombre, v_etapa_actual_tipo
  FROM public.crm_oportunidades o
  JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
  WHERE o.id = NEW.oportunidad_id
    AND o.deleted_at IS NULL;

  IF v_op_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Sólo si la oportunidad sigue abierta
  IF v_etapa_actual_tipo <> 'abierta'::crm_etapa_tipo THEN
    RETURN NEW;
  END IF;

  -- Etapa ganada de la misma org (la primera por orden)
  SELECT id INTO v_etapa_ganada_id
  FROM public.crm_etapas_pipeline
  WHERE organization_id = v_op_org
    AND tipo = 'ganada'::crm_etapa_tipo
    AND activa = true
    AND deleted_at IS NULL
  ORDER BY orden ASC
  LIMIT 1;

  IF v_etapa_ganada_id IS NULL THEN
    -- No hay etapa ganada configurada; no rompemos la operación
    RETURN NEW;
  END IF;

  UPDATE public.crm_oportunidades
     SET etapa_id = v_etapa_ganada_id,
         probabilidad = 100,
         fecha_cierre_real = COALESCE(fecha_cierre_real, CURRENT_DATE),
         valor_real = COALESCE(valor_real, NEW.subtotal),
         cotizacion_ganadora_id = NEW.id,
         embarque_ganador_id = COALESCE(embarque_ganador_id, NEW.embarque_id),
         updated_at = now()
   WHERE id = v_op_id;

  -- Bitácora (best-effort)
  BEGIN
    INSERT INTO public.bitacora_actividad (
      organization_id, modulo, accion, entidad_id, entidad_nombre,
      usuario_id, usuario_email, detalles
    ) VALUES (
      v_op_org, 'crm', 'oportunidad_ganada_auto', v_op_id, v_op_nombre,
      COALESCE(auth.uid(), v_op_vendedor),
      COALESCE((auth.jwt() ->> 'email')::text, ''),
      jsonb_build_object(
        'cotizacion_id', NEW.id,
        'cotizacion_folio', NEW.folio,
        'embarque_id', NEW.embarque_id,
        'monto', NEW.subtotal
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Notificación al vendedor
  IF v_op_vendedor IS NOT NULL THEN
    BEGIN
      INSERT INTO public.crm_notificaciones (
        organization_id, user_id, tipo, titulo, mensaje, link
      ) VALUES (
        v_op_org, v_op_vendedor, 'oportunidad_ganada',
        '¡Oportunidad ganada!',
        '“' || v_op_nombre || '” se cerró automáticamente con la cotización ' || COALESCE(NEW.folio, ''),
        '/crm/oportunidades/' || v_op_id::text
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_cierra_oportunidad ON public.cotizaciones;
CREATE TRIGGER trg_cotizacion_cierra_oportunidad
AFTER INSERT OR UPDATE OF estado, embarque_id ON public.cotizaciones
FOR EACH ROW
EXECUTE FUNCTION public.crm_cierra_oportunidad_desde_cotizacion();