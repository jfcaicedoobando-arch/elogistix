CREATE OR REPLACE FUNCTION public.trg_clientes_normaliza_campos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre := btrim(NEW.nombre);
    IF NEW.nombre = '' THEN
      RAISE EXCEPTION 'LC_CLIENTE_NOMBRE_REQUERIDO: el nombre no puede estar vacío'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.email IS NOT NULL THEN
    NEW.email := btrim(lower(NEW.email));
  END IF;
  IF NEW.rfc IS NOT NULL THEN
    NEW.rfc := btrim(upper(NEW.rfc));
  END IF;
  RETURN NEW;
END;
$function$;