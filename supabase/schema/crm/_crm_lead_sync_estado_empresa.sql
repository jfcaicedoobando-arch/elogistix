CREATE OR REPLACE FUNCTION public._crm_lead_sync_estado_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.crm_empresas e
     SET estado_crm = CASE WHEN NEW.estado::text = 'Convertido' THEN 'Cliente' ELSE 'Prospecto' END
   WHERE e.lead_origen_id = NEW.id AND e.organization_id = NEW.organization_id
     AND e.estado_crm <> 'Cliente'
     AND NEW.estado::text IN ('Prospecto','Calificado','Pendiente de alta','Convertido');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_lead_sync_estado_empresa() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_lead_sync_estado_empresa() TO service_role;
