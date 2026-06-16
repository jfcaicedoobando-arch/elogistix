-- Reemplazar trigger de signup: crear organización + membresía admin + user_role
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
BEGIN
  -- 1. Nombre de empresa con fallback y acotado defensivamente
  v_company_name := trim(coalesce(NEW.raw_user_meta_data->>'company_name', ''));
  IF length(v_company_name) = 0 THEN
    v_company_name := 'Mi organización';
  END IF;
  IF length(v_company_name) > 120 THEN
    v_company_name := substring(v_company_name FROM 1 FOR 120);
  END IF;

  -- 2. Crear organización dedicada al usuario
  INSERT INTO public.organizations (nombre, plan, activo)
  VALUES (v_company_name, 'basic', true)
  RETURNING id INTO v_org_id;

  -- 3. Vincular al usuario como admin de su organización
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'admin'::public.app_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 4. Rol global: primer usuario = super_admin, resto = admin
  SELECT count(*) INTO v_user_count FROM public.user_roles;
  v_global_role := CASE WHEN v_user_count = 0 THEN 'super_admin'::public.app_role
                        ELSE 'admin'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_global_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-apuntar el trigger existente a la nueva función
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();