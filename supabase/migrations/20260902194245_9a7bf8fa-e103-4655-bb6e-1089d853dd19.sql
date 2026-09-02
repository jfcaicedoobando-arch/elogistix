-- ============================================================================
-- v13.823.51 — Candados multiempresa CRM (cotización↔oportunidad,
-- actividad↔entidad) + invariante de probabilidad terminal.
-- Forward-only e idempotente. NO corrige datos: los vínculos legados
-- inválidos se reportan aparte y se conservan tal cual.
-- ============================================================================

-- 1) Cotización ↔ oportunidad: misma organización y oportunidad viva.
CREATE OR REPLACE FUNCTION public._cotizacion_oportunidad_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_oportunidades o
     WHERE o.id = NEW.oportunidad_id
       AND o.organization_id = NEW.organization_id
       AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cotizacion_oportunidad_misma_org ON public.cotizaciones;
CREATE TRIGGER trg_cotizacion_oportunidad_misma_org
BEFORE INSERT OR UPDATE OF oportunidad_id, organization_id ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_oportunidad_misma_org();

-- 2) Actividad ↔ entidad (lead u oportunidad): misma organización y viva.
CREATE OR REPLACE FUNCTION public._crm_actividad_entidad_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.entidad_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.entidad_tipo = 'oportunidad'::public.crm_entidad_tipo THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_oportunidades o
       WHERE o.id = NEW.entidad_id
         AND o.organization_id = NEW.organization_id
         AND o.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_ENTIDAD_AJENA: la oportunidad no existe, está eliminada o pertenece a otra organización';
    END IF;
  ELSIF NEW.entidad_tipo = 'lead'::public.crm_entidad_tipo THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_leads l
       WHERE l.id = NEW.entidad_id
         AND l.organization_id = NEW.organization_id
         AND l.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_ENTIDAD_AJENA: el prospecto no existe, está eliminado o pertenece a otra organización';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_crm_actividad_entidad_misma_org ON public.crm_actividades;
CREATE TRIGGER trg_crm_actividad_entidad_misma_org
BEFORE INSERT OR UPDATE OF entidad_tipo, entidad_id, organization_id ON public.crm_actividades
FOR EACH ROW EXECUTE FUNCTION public._crm_actividad_entidad_misma_org();

-- 3) Segunda barrera: predicados organization_id en las automatizaciones.
CREATE OR REPLACE FUNCTION public._crm_actividad_toca_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.entidad_tipo = 'oportunidad'::public.crm_entidad_tipo AND NEW.entidad_id IS NOT NULL THEN
    UPDATE public.crm_oportunidades
       SET ultimo_movimiento_at = now()
     WHERE id = NEW.entidad_id
       AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._crm_sync_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.crm_oportunidades o
     SET monto_estimado = COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado),
         moneda         = COALESCE(NEW.moneda::text, o.moneda),
         cliente_id     = COALESCE(o.cliente_id, NEW.cliente_id),
         updated_at     = now()
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
     AND (
       COALESCE(o.monto_estimado, 0) <> COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado, 0)
       OR COALESCE(o.moneda, '') <> COALESCE(NEW.moneda::text, o.moneda, '')
       OR (o.cliente_id IS NULL AND NEW.cliente_id IS NOT NULL)
     );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crm_cierra_oportunidad_desde_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_op_id uuid;
  v_op_org uuid;
  v_op_vendedor uuid;
  v_op_nombre text;
  v_etapa_actual_tipo crm_etapa_tipo;
  v_etapa_ganada_id uuid;
BEGIN
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
    AND o.organization_id = NEW.organization_id
    AND o.deleted_at IS NULL;

  IF v_op_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_etapa_actual_tipo <> 'abierta'::crm_etapa_tipo THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_etapa_ganada_id
  FROM public.crm_etapas_pipeline
  WHERE organization_id = v_op_org
    AND tipo = 'ganada'::crm_etapa_tipo
    AND activa = true
    AND deleted_at IS NULL
  ORDER BY orden ASC
  LIMIT 1;

  IF v_etapa_ganada_id IS NULL THEN
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
   WHERE id = v_op_id
     AND organization_id = v_op_org;

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
$function$;

CREATE OR REPLACE FUNCTION public.crm_set_valor_real_on_aceptada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previo numeric;
BEGIN
  IF NEW.oportunidad_id IS NOT NULL
     AND NEW.estado = 'Aceptada'::estado_cotizacion
     AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    SELECT valor_real INTO v_previo
      FROM public.crm_oportunidades
     WHERE id = NEW.oportunidad_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    UPDATE public.crm_oportunidades
       SET valor_real = NEW.subtotal,
           fecha_cierre_real = CURRENT_DATE,
           updated_at = now()
     WHERE id = NEW.oportunidad_id
       AND organization_id = NEW.organization_id
       AND deleted_at IS NULL;
    IF v_previo IS DISTINCT FROM NEW.subtotal THEN
      INSERT INTO public.bitacora_actividad (
        organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
      ) VALUES (
        NEW.organization_id, auth.uid(),
        COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
        'crm.oportunidad.valor_real_actualizado',
        'crm_oportunidades',
        NEW.oportunidad_id,
        '',
        jsonb_build_object('valor_previo', v_previo, 'valor_nuevo', NEW.subtotal,
                          'cotizacion_id', NEW.id, 'version', NEW.version)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Invariante de probabilidad terminal en cualquier ruta (no sólo el Kanban).
CREATE OR REPLACE FUNCTION public._crm_probabilidad_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tipo INTO v_tipo FROM public.crm_etapas_pipeline WHERE id = NEW.etapa_id;
  IF v_tipo = 'ganada'::crm_etapa_tipo THEN
    NEW.probabilidad := 100;
  ELSIF v_tipo = 'perdida'::crm_etapa_tipo THEN
    NEW.probabilidad := 0;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_crm_probabilidad_terminal ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_probabilidad_terminal
BEFORE INSERT OR UPDATE OF etapa_id, probabilidad ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public._crm_probabilidad_terminal();

REVOKE EXECUTE ON FUNCTION public._cotizacion_oportunidad_misma_org() FROM anon;
REVOKE EXECUTE ON FUNCTION public._crm_actividad_entidad_misma_org() FROM anon;
REVOKE EXECUTE ON FUNCTION public._crm_probabilidad_terminal() FROM anon;