CREATE OR REPLACE FUNCTION public.diagnosticar_baja_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_activa uuid := public.current_user_org_id();
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- The existing global Super Admin mutation authority is not a new read grant.
  -- Gate before lookup: missing, foreign and invisible IDs have the same error.
  IF (v_uid IS NOT NULL AND v_activa IS NOT NULL
    AND (public.has_role(v_uid, 'super_admin'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'operador'::public.app_role))
    AND public.has_any_role(v_uid, ARRAY['viewer'::public.app_role])
    AND (NOT public.has_role(v_uid, 'super_admin'::public.app_role)
      OR public.rls_tenant_scope_ok(v_activa))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_activa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  PERFORM public._h14_assert_actor_baja_embarque(p_embarque_id);
  v_result := public._h14_dependencias_baja_embarque(p_embarque_id, v_org, true);
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque en la organización activa' USING ERRCODE = '42501';
  END IF;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.diagnosticar_baja_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diagnosticar_baja_embarque(uuid) TO authenticated, service_role, postgres;
