-- Serializa las nuevas reclamaciones de identidad con la conversión, que ya
-- retiene el lead. No barre ni modifica relaciones históricas.
CREATE OR REPLACE FUNCTION public._crm_empresa_validar_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lead public.crm_leads%ROWTYPE;
BEGIN
  IF NEW.lead_origen_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.lead_origen_id IS NOT DISTINCT FROM OLD.lead_origen_id
    AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN RETURN NEW; END IF;
  SELECT * INTO v_lead FROM public.crm_leads WHERE id = NEW.lead_origen_id FOR UPDATE;
  -- Igual que el guard de atribución, conservar productores privilegiados que
  -- reconstruyen espejos históricos; también retienen el lock si el lead existe.
  IF auth.role() = 'service_role'
    OR (auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'authenticated') THEN RETURN NEW; END IF;
  IF NOT FOUND OR v_lead.deleted_at IS NOT NULL
    OR v_lead.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'LC_CRM_LEAD_AJENO' USING ERRCODE = '23514';
  END IF;
  -- Una reclamación interactiva no puede ganar tras una conversión.
  IF v_lead.cliente_convertido_id IS NOT NULL OR v_lead.estado::text = 'Convertido' THEN
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_validar_lead() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_validar_lead() TO service_role;
CREATE OR REPLACE TRIGGER trg_crm_empresa_validar_lead
BEFORE INSERT OR UPDATE OF lead_origen_id, organization_id ON public.crm_empresas
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_validar_lead();

