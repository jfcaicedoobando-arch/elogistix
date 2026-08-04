CREATE OR REPLACE FUNCTION public._normalizar_razon_social()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre := upper(regexp_replace(btrim(NEW.nombre), '\s+', ' ', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_nombre_mayusculas ON public.clientes;
CREATE TRIGGER trg_clientes_nombre_mayusculas
  BEFORE INSERT OR UPDATE OF nombre ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public._normalizar_razon_social();

DROP TRIGGER IF EXISTS trg_proveedores_nombre_mayusculas ON public.proveedores;
CREATE TRIGGER trg_proveedores_nombre_mayusculas
  BEFORE INSERT OR UPDATE OF nombre ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public._normalizar_razon_social();

UPDATE public.clientes
   SET nombre = upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g'))
 WHERE nombre IS NOT NULL
   AND nombre <> upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g'));

UPDATE public.proveedores
   SET nombre = upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g'))
 WHERE nombre IS NOT NULL
   AND nombre <> upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g'));