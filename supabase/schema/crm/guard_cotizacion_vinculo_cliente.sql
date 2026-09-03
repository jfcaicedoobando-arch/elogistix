-- P0 (corrección) · Candado de conversión: sólo la RPC canónica puede ligar un
-- prospecto a un cliente, y ningún vínculo puede apuntar a otra organización.
CREATE OR REPLACE FUNCTION public.guard_cotizacion_vinculo_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1) Bypass por UPDATE directo desde el cliente (PostgREST): prohibido.
  IF TG_OP = 'UPDATE' AND current_user IN ('authenticated', 'anon') THEN
    IF COALESCE(OLD.es_prospecto, false) = true
       AND (
         (NEW.cliente_id IS NOT NULL AND OLD.cliente_id IS NULL)
         OR COALESCE(NEW.es_prospecto, false) IS DISTINCT FROM true
       ) THEN
      RAISE EXCEPTION 'LC_CONVERSION_SOLO_RPC' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2) Cualquier rol: el cliente ligado debe existir, estar vivo y ser de la
  --    misma organización de la cotización.
  IF NEW.cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = NEW.cliente_id
        AND c.organization_id = NEW.organization_id
        AND c.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_COTIZACION_CLIENTE_AJENO_INEXISTENTE' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.guard_cotizacion_vinculo_cliente() OWNER TO postgres;

COMMENT ON FUNCTION public.guard_cotizacion_vinculo_cliente() IS
  'Candado de cotizaciones: bloquea la conversión prospecto→cliente por UPDATE directo (LC_CONVERSION_SOLO_RPC) y exige que cliente_id sea un cliente vivo de la misma organización.';

DROP TRIGGER IF EXISTS trg_guard_cotizacion_vinculo_cliente ON public.cotizaciones;
CREATE TRIGGER trg_guard_cotizacion_vinculo_cliente
BEFORE INSERT OR UPDATE OF cliente_id, es_prospecto, organization_id ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.guard_cotizacion_vinculo_cliente();
