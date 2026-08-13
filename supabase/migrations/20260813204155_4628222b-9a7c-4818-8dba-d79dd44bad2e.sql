CREATE OR REPLACE FUNCTION public._assert_refacturador(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_uid
      AND organization_id = p_org
      AND role IN ('admin_org','admin','contador','auxiliar_contable')
  ) THEN
    RAISE EXCEPTION 'LC_REFACT_FORBIDDEN: se requiere rol de administrador de la organización o un rol contable'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_refacturador(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_refacturador(uuid) TO authenticated, service_role;