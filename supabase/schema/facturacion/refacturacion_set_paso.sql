CREATE OR REPLACE FUNCTION public.refacturacion_set_paso(p_caso_id uuid, p_paso smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.refacturaciones WHERE id = p_caso_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_org);
  IF p_paso < 1 OR p_paso > 5 THEN
    RAISE EXCEPTION 'LC_REFACT_PASO: paso fuera de rango' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.refacturaciones
     SET paso_actual = GREATEST(paso_actual, p_paso)
   WHERE id = p_caso_id AND estado = 'abierto';
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturacion_set_paso(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refacturacion_set_paso(uuid, smallint) TO authenticated, service_role;
