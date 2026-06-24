-- 1) Registra el cuerpo real que ya existe en prod (idempotente)
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE prefijo text; consecutivo int;
BEGIN
  consecutivo := nextval('embarque_consecutivo_seq');
  CASE tipo_op
    WHEN 'Importación' THEN prefijo := 'IMP';
    WHEN 'Exportación' THEN prefijo := 'EXP';
    WHEN 'Nacional'    THEN prefijo := 'NAC';
    ELSE prefijo := 'GEN';
  END CASE;
  RETURN 'EL' || prefijo || lpad(consecutivo::text, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(text) TO authenticated, service_role;

-- 2) Re-asegura el overload por enum (idempotente)
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.generar_expediente(tipo_op::text); $$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;