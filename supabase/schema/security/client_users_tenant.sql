-- Fuente canónica de public.current_user_client_ids y de la RPC que gestiona
-- los accesos del portal de cliente (defecto 1: pareja cliente/organización).
CREATE OR REPLACE FUNCTION public.current_user_client_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cu.cliente_id
  FROM public.client_users cu
  JOIN public.clientes c
    ON c.id = cu.cliente_id
   AND c.organization_id = cu.organization_id
  WHERE cu.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.current_user_client_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revocar_usuario_portal_cliente(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente uuid;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO: inicia sesión para revocar accesos'
      USING ERRCODE = '42501';
  END IF;

  SELECT cu.cliente_id, c.organization_id
    INTO v_cliente, v_org
  FROM public.client_users cu
  JOIN public.clientes c ON c.id = cu.cliente_id
  WHERE cu.id = p_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'LC_PORTAL_VINCULO_INEXISTENTE: el acceso ya no existe'
      USING ERRCODE = '22023';
  END IF;

  -- El tenant válido es el del CLIENTE, no el declarado en el vínculo.
  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT public.has_any_role_in_org_exact(
       v_uid, ARRAY['admin','admin_org','operador']::app_role[], v_org) THEN
    RAISE EXCEPTION 'LC_PORTAL_SIN_PERMISO: requiere un rol administrativo en la organización del cliente'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.client_users WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.revocar_usuario_portal_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revocar_usuario_portal_cliente(uuid) TO authenticated, service_role;
