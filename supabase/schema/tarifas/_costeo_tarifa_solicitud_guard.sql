CREATE OR REPLACE FUNCTION public._costeo_tarifa_solicitud_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_estado text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.solicitud_pricing_id IS DISTINCT FROM OLD.solicitud_pricing_id THEN
    RAISE EXCEPTION 'LC_TARIFA_SOLICITUD_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.solicitud_pricing_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_org, v_estado
      FROM public.crm_solicitudes_pricing WHERE id = NEW.solicitud_pricing_id AND deleted_at IS NULL;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
    END IF;
    IF v_estado <> 'enviada' THEN
      RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public._crm_es_pricing(v_org) THEN
      RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public._costeo_tarifa_solicitud_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._costeo_tarifa_solicitud_guard() TO service_role;
