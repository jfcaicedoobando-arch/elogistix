-- 1. Nuevas etapas del ciclo de vida del prospecto
ALTER TYPE public.crm_lead_estado ADD VALUE IF NOT EXISTS 'Prospecto' AFTER 'Calificado';
ALTER TYPE public.crm_lead_estado ADD VALUE IF NOT EXISTS 'Pendiente de alta' AFTER 'Prospecto';

-- 2. Trigger: avanzar el lead según el estado de su cotización de prospecto.
CREATE OR REPLACE FUNCTION public._crm_lead_avanzar_por_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_destino text;
BEGIN
  IF NEW.oportunidad_id IS NULL OR COALESCE(NEW.es_prospecto, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.estado::text = 'Aceptada' THEN
    v_destino := 'Pendiente de alta';
  ELSIF NEW.estado::text IN ('Solicitada', 'Enviada') THEN
    v_destino := 'Prospecto';
  ELSE
    RETURN NEW;
  END IF;

  SELECT o.lead_id INTO v_lead_id
  FROM public.crm_oportunidades o
  WHERE o.id = NEW.oportunidad_id
    AND o.organization_id = NEW.organization_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.crm_leads l
     SET estado = v_destino::public.crm_lead_estado,
         updated_at = now()
   WHERE l.id = v_lead_id
     AND l.organization_id = NEW.organization_id
     AND l.deleted_at IS NULL
     AND l.estado::text NOT IN ('Descalificado', 'Convertido')
     AND l.estado::text <> v_destino
     AND NOT (v_destino = 'Prospecto' AND l.estado::text = 'Pendiente de alta');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._crm_lead_avanzar_por_cotizacion() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_crm_lead_avanzar_por_cotizacion ON public.cotizaciones;
CREATE TRIGGER trg_crm_lead_avanzar_por_cotizacion
AFTER UPDATE OF estado ON public.cotizaciones
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION public._crm_lead_avanzar_por_cotizacion();
