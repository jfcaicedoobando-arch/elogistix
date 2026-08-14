-- Espejo de `public._cotizaciones_sync_vigencia` (Ola 18).
-- La vigencia mostrada en el detalle y en el PDF debe ser la fecha capturada
-- por el usuario en "Validez propuesta". SECURITY INVOKER a propósito: sólo
-- normaliza columnas de la fila entrante (no consulta otras tablas).
CREATE OR REPLACE FUNCTION public._cotizaciones_sync_vigencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base date;
BEGIN
  -- Día de emisión en zona CDMX (estándar de fechas del proyecto): nunca
  -- `now()::date` en UTC, que después de las 18:00 locales adelanta un día.
  v_base := COALESCE(
    (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
    (now() AT TIME ZONE 'America/Mexico_City')::date
  );

  IF NEW.validez_propuesta IS NOT NULL THEN
    -- Fuente única de verdad: la fecha capturada por el usuario.
    NEW.fecha_vigencia := NEW.validez_propuesta;
    NEW.vigencia_dias := GREATEST(1, (NEW.validez_propuesta - v_base))::int;
  ELSE
    NEW.vigencia_dias := COALESCE(NEW.vigencia_dias, 15);
    NEW.fecha_vigencia := COALESCE(NEW.fecha_vigencia, v_base + NEW.vigencia_dias);
  END IF;

  RETURN NEW;
END;
$$;
