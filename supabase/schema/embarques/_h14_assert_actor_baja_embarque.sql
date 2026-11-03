CREATE OR REPLACE FUNCTION public._h14_assert_actor_baja_embarque(p_embarque_id uuid)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: permisos insuficientes para eliminar embarques' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  IF (public.has_role(v_uid, 'super_admin'::public.app_role)
    OR (v_org = public.current_user_org_id()
      AND (public.has_role(v_uid, 'admin'::public.app_role)
        OR public.has_role(v_uid, 'operador'::public.app_role)))) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: permisos insuficientes para eliminar embarques (se requiere rol admin u operador de la organización del embarque)'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_org;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_assert_actor_baja_embarque(uuid) FROM PUBLIC, anon, authenticated, service_role;
