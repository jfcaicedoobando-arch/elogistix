-- Fase 7 (ajuste): organization_id con default como el resto del CRM.
ALTER TABLE public.crm_tableros
  ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.crm_reportes
  ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();