CREATE OR REPLACE FUNCTION public._assert_facturapi_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '28000';
  END IF;

  -- super_admin o contador (roles globales) siempre pueden
  IF public.has_role(v_uid, 'super_admin'::public.app_role)
     OR public.has_role(v_uid, 'contador'::public.app_role) THEN
    RETURN;
  END IF;

  -- admin_org / admin dentro de la organización también
  IF NOT EXISTS (
    SELECT 1
      FROM public.organization_members om
     WHERE om.user_id = v_uid
       AND om.organization_id = p_org_id
       AND om.role IN ('admin_org','admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;