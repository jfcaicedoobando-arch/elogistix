-- Fix: public.auditoria_embarques_org(uuid) perdió SECURITY DEFINER cuando el
-- wrapper de 'costos_repetidos' la redefinió, provocando 42501
-- "permission denied for function _audit_embarques_agregar" para authenticated.
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base jsonb;
  v_extras jsonb;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id es obligatorio';
  END IF;

  -- Guard explícito: al ser SECURITY DEFINER debemos validar al invocador aquí.
  PERFORM public._assert_internal_reader(p_organization_id);

  v_base := public._auditoria_embarques_org_base(p_organization_id);
  v_extras := public._audit_costos_repetidos(p_organization_id);

  IF v_extras IS NULL OR jsonb_array_length(v_extras) = 0 THEN
    RETURN v_base;
  END IF;

  RETURN public._audit_embarques_agregar(
    COALESCE(v_base->'hallazgos', '[]'::jsonb),
    COALESCE(v_base->'umbrales', '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.auditoria_embarques_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auditoria_embarques_org(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org(uuid) TO service_role;