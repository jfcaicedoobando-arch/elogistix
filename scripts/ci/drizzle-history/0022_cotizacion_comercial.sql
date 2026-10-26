ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS vendedor_id uuid NULL;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS vendedor_email text NULL;
COMMENT ON COLUMN public.cotizaciones.vendedor_id IS 'Comercial asignado a la cotización (miembro de la misma organización). NULL = sin asignar.';
COMMENT ON COLUMN public.cotizaciones.vendedor_email IS 'Correo del comercial; lo resuelve el trigger desde vendedor_id, nunca el cliente.';

CREATE OR REPLACE FUNCTION public._cotizacion_vendedor_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NEW.vendedor_id IS NULL THEN
    NEW.vendedor_email := NULL;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.user_id = NEW.vendedor_id
       AND m.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'LC_COMERCIAL_AJENO: el comercial no pertenece a esta organización';
  END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = NEW.vendedor_id;
  NEW.vendedor_email := v_email;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._cotizacion_vendedor_misma_org() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cotizacion_vendedor_misma_org
BEFORE INSERT OR UPDATE OF vendedor_id, vendedor_email, organization_id ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_vendedor_misma_org();
