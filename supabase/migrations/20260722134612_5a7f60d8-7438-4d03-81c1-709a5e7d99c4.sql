-- R2-16 · Auto-registro asigna admin_org (moderno) en vez de admin (legacy).
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name text;
  v_org_id uuid;
  v_user_count int;
  v_global_role public.app_role;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  -- R2-16 (v13.306.3): auto-signup público asigna 'admin_org' (rol moderno
  -- que sólo administra su propia organización). Antes se otorgaba 'admin'
  -- legacy — que en algunos code paths se interpretaba como admin global.
  -- Las invitaciones desde consola siguen pasando `skip_auto_org=true` y
  -- fijan su propio rol vía user-management/create.
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
    VALUES (v_org_id, NEW.id, 'admin_org'::public.app_role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  SELECT count(*) INTO v_user_count FROM public.user_roles;
  -- Bootstrap: primer usuario del sistema = super_admin (para instalación fresca).
  v_global_role := CASE WHEN v_user_count = 0 THEN 'super_admin'::public.app_role
                        ELSE 'admin_org'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_global_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Retro-fix: convertir a admin_org los user_roles.role='admin' que fueron
-- generados por auto-signup (existe la membresía pareja como 'admin' en
-- su organización). No toca super_admins ni admins explícitamente asignados
-- por consola (que ya usan roles modernos como admin_org/gerente_*/etc).
UPDATE public.user_roles ur
SET role = 'admin_org'::public.app_role
WHERE ur.role = 'admin'::public.app_role
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = ur.user_id
      AND om.role = 'admin'::public.app_role
  );

-- Y homologar la membresía correspondiente a admin_org.
UPDATE public.organization_members om
SET role = 'admin_org'::public.app_role
WHERE om.role = 'admin'::public.app_role
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = om.user_id
      AND ur.role IN ('admin_org'::public.app_role, 'admin'::public.app_role)
  );