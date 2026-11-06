CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    -- FIX4 N-1: la reversión 'En operación' → 'Aceptada' es housekeeping de
    -- la papelera, no un cambio de estado del flujo comercial; la GUC
    -- transaccional lo deja pasar por guard_estado_cotizacion (patrón
    -- app.bypass_cierre).
    PERFORM set_config('app.liberando_papelera', 'on', true);
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = NEW.id
       AND organization_id = NEW.organization_id;
    PERFORM set_config('app.liberando_papelera', 'off', true);
    RETURN NEW;
  END IF;

  IF NEW.cotizacion_id IS NOT NULL THEN
    PERFORM 1
      FROM public.cotizaciones
     WHERE id = NEW.cotizacion_id
       AND organization_id = NEW.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_COTIZACION_OTRA_ORG: la cotización no existe o pertenece a otra organización'
        USING ERRCODE = '23514',
              HINT    = json_build_object(
                'cotizacion_id', NEW.cotizacion_id,
                'organization_id', NEW.organization_id
              )::text;
    END IF;

    UPDATE public.cotizaciones
    SET
      embarque_id = NEW.id,
      estado = CASE
        WHEN estado = 'Aceptada'::estado_cotizacion
             AND NEW.estado NOT IN ('Borrador'::estado_embarque, 'Cotización'::estado_embarque, 'Cancelado'::estado_embarque)
        THEN 'En operación'::estado_cotizacion
        ELSE estado
      END,
      updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND organization_id = NEW.organization_id
      AND (
        embarque_id IS DISTINCT FROM NEW.id
        OR (estado = 'Aceptada'::estado_cotizacion AND NEW.estado NOT IN ('Borrador'::estado_embarque, 'Cotización'::estado_embarque, 'Cancelado'::estado_embarque))
      );
  END IF;
  RETURN NEW;
END;
$function$

