CREATE OR REPLACE FUNCTION public._crm_oportunidad_requiere_origen() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lead_org uuid;
  v_lead_estado public.crm_lead_estado;
  v_cliente_org uuid;
BEGIN
  IF NEW.lead_id IS NULL AND NEW.cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_SIN_ORIGEN';
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_lead_org, v_lead_estado
      FROM public.crm_leads
     WHERE id = NEW.lead_id AND deleted_at IS NULL;
    IF v_lead_org IS NULL OR v_lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_LEAD_AJENO';
    END IF;
    IF v_lead_estado IN (
      'Nuevo'::public.crm_lead_estado,
      'Contactado'::public.crm_lead_estado,
      'Descalificado'::public.crm_lead_estado
    ) THEN
      RAISE EXCEPTION 'LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO';
    END IF;
  END IF;

  IF NEW.cliente_id IS NOT NULL THEN
    SELECT organization_id INTO v_cliente_org
      FROM public.clientes
     WHERE id = NEW.cliente_id AND deleted_at IS NULL;
    IF v_cliente_org IS NULL OR v_cliente_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_CRM_CLIENTE_AJENO';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;