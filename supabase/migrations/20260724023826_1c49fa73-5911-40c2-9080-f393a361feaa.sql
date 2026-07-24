CREATE OR REPLACE FUNCTION public.provision_organization(p_nombre text, p_rfc text, p_owner_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_caller uuid := auth.uid();
  v_caller_email text;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_rfc text := NULLIF(btrim(coalesce(p_rfc, '')), '');
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Sólo super_admin puede aprovisionar organizaciones'
      USING ERRCODE = '42501';
  END IF;

  IF v_nombre = '' THEN
    RAISE EXCEPTION 'Nombre requerido' USING ERRCODE = '22023';
  END IF;

  IF length(v_nombre) > 200 THEN
    RAISE EXCEPTION 'Nombre demasiado largo (máx 200)' USING ERRCODE = '22023';
  END IF;

  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner requerido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Usuario owner no existe' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE lower(nombre) = lower(v_nombre)
      AND (rfc IS NOT DISTINCT FROM v_rfc)
  ) THEN
    RAISE EXCEPTION 'Ya existe una organización con ese nombre/RFC'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.organizations (nombre, rfc)
  VALUES (v_nombre, v_rfc)
  RETURNING id INTO v_org_id;

  -- Rol moderno: 'admin_org' reemplaza al legacy 'admin' (bloqueado por trg_bloquear_rol_legacy_om desde v13.312.0)
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_owner_user_id, 'admin_org'::app_role)
  ON CONFLICT DO NOTHING;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller;
  INSERT INTO public.bitacora_actividad(
    usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, organization_id, detalles
  ) VALUES (
    v_caller,
    coalesce(v_caller_email, ''),
    'provision_organization',
    'admin_super',
    v_org_id,
    v_nombre,
    v_org_id,
    jsonb_build_object('owner_user_id', p_owner_user_id, 'rfc', v_rfc)
  );

  RETURN v_org_id;
END;
$function$;
-- H6: REVOKE/GRANT
REVOKE ALL ON FUNCTION public.provision_organization(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text, uuid) TO authenticated, service_role, postgres;
