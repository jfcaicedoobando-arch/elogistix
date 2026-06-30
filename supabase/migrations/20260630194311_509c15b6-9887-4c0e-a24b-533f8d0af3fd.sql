
-- 1) Trigger function: forzar que costeo_tarifas.organization_id coincida con el del agente referenciado.
CREATE OR REPLACE FUNCTION public.costeo_tarifas_match_agente_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agente_org uuid;
BEGIN
  SELECT organization_id INTO v_agente_org
    FROM public.costeo_agentes
   WHERE id = NEW.agente_id;

  IF v_agente_org IS NULL THEN
    RAISE EXCEPTION 'Agente % no existe', NEW.agente_id;
  END IF;

  -- Si vino con org distinta, la corregimos silenciosamente.
  NEW.organization_id := v_agente_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS costeo_tarifas_match_agente_org_trg ON public.costeo_tarifas;
CREATE TRIGGER costeo_tarifas_match_agente_org_trg
BEFORE INSERT OR UPDATE OF organization_id, agente_id
ON public.costeo_tarifas
FOR EACH ROW
EXECUTE FUNCTION public.costeo_tarifas_match_agente_org();

-- 2) Reparar registros existentes mal asignados.
UPDATE public.costeo_tarifas t
   SET organization_id = a.organization_id
  FROM public.costeo_agentes a
 WHERE a.id = t.agente_id
   AND t.organization_id <> a.organization_id;
