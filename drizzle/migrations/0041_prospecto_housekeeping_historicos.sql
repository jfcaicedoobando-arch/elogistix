CREATE OR REPLACE FUNCTION public._cotizaciones_validar_prospecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.es_prospecto, false) THEN
    IF NEW.cliente_id IS NOT NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_CON_CLIENTE: una cotización de prospecto no puede tener cliente ligado';
    END IF;
    IF NULLIF(btrim(COALESCE(NEW.prospecto_empresa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_SIN_EMPRESA: captura la empresa del prospecto';
    END IF;
    -- La captura nueva exige convertir al prospecto antes de enviarla.
    -- Vencida/Archivada son housekeeping, no una salida comercial; los
    -- históricos ya enviados conservan sus transiciones posteriores.
    IF (TG_OP = 'INSERT' AND NEW.estado <> 'Borrador')
       OR (TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado AND (
         (OLD.estado IN ('Borrador', 'Solicitada')
          AND NEW.estado NOT IN ('Borrador', 'Vencida'))
         OR (OLD.estado IN ('Vencida', 'Archivada')
          AND OLD.estado_anterior IN ('Borrador', 'Solicitada')
          AND NEW.estado NOT IN ('Borrador', 'Archivada'))
       )) THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_SOLO_BORRADOR: da de alta al prospecto como cliente antes de enviar la cotización';
    END IF;
  ELSIF NEW.cliente_id IS NULL AND NEW.estado <> 'Borrador' THEN
    RAISE EXCEPTION 'LC_COT_CLIENTE_REQUERIDO: una cotización de cliente requiere cliente ligado';
  END IF;
  RETURN NEW;
END;
$function$;