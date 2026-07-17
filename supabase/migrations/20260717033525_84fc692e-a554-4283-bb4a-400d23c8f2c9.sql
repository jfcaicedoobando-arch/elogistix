
CREATE OR REPLACE FUNCTION public.provision_organization(
  p_nombre text,
  p_rfc text,
  p_owner_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Sólo super_admin puede aprovisionar organizaciones' USING ERRCODE = '42501';
  END IF;

  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'Nombre requerido' USING ERRCODE = '22023';
  END IF;

  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner requerido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Usuario owner no existe' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organizations (nombre, rfc)
  VALUES (btrim(p_nombre), NULLIF(btrim(p_rfc), ''))
  RETURNING id INTO v_org_id;

  -- El trigger handle_new_organization ya siembra catálogos neutros.

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_owner_user_id, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_organization(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text, uuid) TO service_role;
