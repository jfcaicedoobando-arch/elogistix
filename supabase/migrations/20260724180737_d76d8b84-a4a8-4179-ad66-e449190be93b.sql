CREATE OR REPLACE FUNCTION public.ensure_demo_membership(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin_org'::app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin_org'::app_role;

  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, 'de100000-0000-0000-0000-000000000001'::uuid, 'admin_org'::app_role)
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        role            = EXCLUDED.role;
END;
$function$;