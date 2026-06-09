
-- Fix 12.66.2: redefine has_role and is_org_admin to treat legacy role names
-- as functional categories that include their modern equivalents. This makes
-- the ~100+ RLS policies and RPCs that still check has_role(uid,'admin'|'operador'|'viewer')
-- work for users with modern roles (admin_org, coordinador_logistico, etc.)
-- without rewriting every policy.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        CASE _role
          WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
          WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
          WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
          WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','ejecutivo_pricing','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
          WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','ejecutivo_pricing','gerente_operaciones','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
          WHEN 'vendedor'::app_role THEN ARRAY['vendedor','admin_org','super_admin']::app_role[]
          ELSE ARRAY[_role]::app_role[]
        END
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.organization_id = _org_id
        AND om.role IN ('admin','admin_org')
    );
$function$;
