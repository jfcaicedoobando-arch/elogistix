CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_name text;
  v_org_id uuid;
  v_user_count int;
  v_global_role public.app_role;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  IF NOT v_skip THEN
    v_company_name := trim(coalesce(NEW.raw_user_meta_data->>'company_name', ''));
    IF length(v_company_name) = 0 THEN
      v_company_name := 'Mi organización';
    END IF;
    IF length(v_company_name) > 120 THEN
      v_company_name := substring(v_company_name FROM 1 FOR 120);
    END IF;

    INSERT INTO public.organizations (nombre, plan, activo)
    VALUES (v_company_name, 'basic', true)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'admin'::public.app_role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  SELECT count(*) INTO v_user_count FROM public.user_roles;
  v_global_role := CASE WHEN v_user_count = 0 THEN 'super_admin'::public.app_role
                        ELSE 'admin'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_global_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;