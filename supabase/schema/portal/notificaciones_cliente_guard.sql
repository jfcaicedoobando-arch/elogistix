-- Fuente canónica de public._notif_cliente_validar (defecto 3): impide
-- notificaciones cross-org y URLs fuera del portal.
CREATE OR REPLACE FUNCTION public._notif_cliente_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = NEW.cliente_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_NOTIF_CLIENTE_INEXISTENTE: el cliente de la notificación no existe'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_NOTIF_CROSS_ORG: el cliente no pertenece a la organización de la notificación'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.embarque_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.id = NEW.embarque_id
      AND e.organization_id = v_org
      AND e.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_EMBARQUE_AJENO: el embarque referido no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.factura_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id = NEW.factura_id
      AND f.organization_id = v_org
      AND f.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_FACTURA_AJENA: la factura referida no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Allowlist: sólo rutas internas del portal (nunca URLs absolutas).
  IF NEW.url IS NOT NULL AND NEW.url <> '' THEN
    IF NEW.url !~ '^/portal(/[A-Za-z0-9._~-]+)*$' THEN
      RAISE EXCEPTION 'LC_NOTIF_URL_NO_PERMITIDA: sólo se permiten enlaces internos del portal'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._notif_cliente_validar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._notif_cliente_validar() TO authenticated, service_role;
