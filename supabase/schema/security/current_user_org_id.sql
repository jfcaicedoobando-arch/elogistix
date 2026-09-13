-- Espejo canónico de public.current_user_org_id (B-1: tenant activo manda para super_admin).
-- Fuente vigente: 20260913005047_3264e7eb-6cf0-414a-9af4-28b0945bc7b7.sql
-- Vigilado por `bun run audit:schema-functions`.

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin'::app_role)
      THEN COALESCE(
             (SELECT s.organization_id FROM public.super_admin_org_activa s
               WHERE s.user_id = auth.uid()),
             public.default_user_org_id())
    ELSE public.default_user_org_id()
  END;
$function$;
