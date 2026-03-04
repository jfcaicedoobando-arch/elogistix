
-- Secuencia global para expedientes (0 embarques existentes, empieza en 1)
CREATE SEQUENCE IF NOT EXISTS public.embarque_consecutivo_seq START WITH 1;

-- Función generadora de expediente
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefijo text;
  consecutivo int;
BEGIN
  consecutivo := nextval('embarque_consecutivo_seq');
  CASE tipo_op
    WHEN 'Importación' THEN prefijo := 'IMP';
    WHEN 'Exportación' THEN prefijo := 'EXP';
    WHEN 'Nacional' THEN prefijo := 'NAC';
    ELSE prefijo := 'GEN';
  END CASE;
  RETURN 'EL' || prefijo || lpad(consecutivo::text, 5, '0');
END;
$$;

-- Eliminar columnas redundantes
ALTER TABLE public.embarques DROP COLUMN IF EXISTS referencia_operacion;
ALTER TABLE public.embarques DROP COLUMN IF EXISTS embarque_padre_id;
