-- v13.823.62 · Estados de lead: separa manuales de administrados por el ERP.
-- Guard forward-only, sin backfill y sin tocar las funciones canónicas
-- (crm_calificar_prospecto, _crm_lead_avanzar_por_cotizacion, convertir_lead_rpc,
--  convertir_prospecto_a_cliente_rpc, crm_propagar_conversion_cliente).

CREATE OR REPLACE FUNCTION public.guard_crm_lead_estado_canonico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  -- Fuente única en base: espeja LEAD_ESTADOS_MANUALES del frontend.
  c_manuales constant text[] := ARRAY['Nuevo', 'Contactado', 'Descalificado'];
  v_mensaje constant text :=
    'Ese estado lo administra el ERP: se asigna al calificar, cotizar o convertir el lead. A mano sólo puedes usar Nuevo, Contactado o Descalificado.';
BEGIN
  -- Sólo aplica a escritores directos por la Data API. Los escritores canónicos
  -- son SECURITY DEFINER propiedad de postgres, así que current_user no es
  -- anon/authenticated cuando corren y quedan fuera del candado.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT (NEW.estado::text = ANY (c_manuales)) THEN
      RAISE EXCEPTION 'LC_LEAD_ESTADO_DERIVADO: %', v_mensaje USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: conservar exactamente el mismo estado (incluido uno derivado) es
  -- válido; sólo se vigila el CAMBIO de estado, y debe ser manual → manual.
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT (NEW.estado::text = ANY (c_manuales)) OR NOT (OLD.estado::text = ANY (c_manuales)) THEN
      RAISE EXCEPTION 'LC_LEAD_ESTADO_DERIVADO: %', v_mensaje USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_crm_lead_estado_canonico() IS
  'v13.823.62 · Impide que anon/authenticated asignen a mano los estados de lead administrados por el ERP (Calificado, Prospecto, Pendiente de alta, Convertido). SECURITY INVOKER a propósito: los escritores canónicos SECURITY DEFINER (owner postgres) quedan fuera del candado.';

DROP TRIGGER IF EXISTS trg_guard_crm_lead_estado_canonico ON public.crm_leads;

CREATE TRIGGER trg_guard_crm_lead_estado_canonico
BEFORE INSERT OR UPDATE OF estado ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.guard_crm_lead_estado_canonico();