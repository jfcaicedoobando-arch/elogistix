CREATE OR REPLACE FUNCTION public.get_operadores_para_cotizacion(
  p_cotizacion_id uuid
)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id
    AND cliente_id IN (SELECT public.current_user_client_ids());

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT om.user_id, u.email::text
  FROM public.organization_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.organization_id = v_org
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND u.email IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_operadores_para_cotizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_operadores_para_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operadores_para_cotizacion(uuid) TO service_role;