CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.generar_expediente(tipo_op::text);
$$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;