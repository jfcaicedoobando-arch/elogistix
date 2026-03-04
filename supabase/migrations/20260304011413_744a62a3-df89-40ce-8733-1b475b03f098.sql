
CREATE OR REPLACE FUNCTION public.resolver_expediente_por_bl(_bl_master text, _tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expediente_existente text;
BEGIN
  -- Buscar si ya existe un embarque con ese BL Master
  SELECT expediente INTO expediente_existente
  FROM public.embarques
  WHERE bl_master = _bl_master
  LIMIT 1;

  IF expediente_existente IS NOT NULL THEN
    RETURN expediente_existente;
  END IF;

  -- Si no existe, generar uno nuevo
  RETURN public.generar_expediente(_tipo_op);
END;
$$;
