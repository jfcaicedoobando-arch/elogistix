-- Ola 18 · La vigencia de la cotización debe respetar la validez propuesta
-- capturada por el usuario. Antes `fecha_vigencia` sólo se calculaba en el
-- INSERT (emisión + `vigencia_dias`, default 15) y los UPDATE posteriores que
-- capturaban `validez_propuesta` NO la recalculaban: la tarjeta de detalle y
-- el PDF seguían mostrando la fecha vieja (caso COT-2026-0174: validez
-- 21/08/2026 vs vigencia 29/08/2026).
--
-- SECURITY INVOKER a propósito: es un trigger BEFORE que sólo normaliza
-- columnas de la fila entrante; no consulta otras tablas ni necesita escalar
-- privilegios (no aplica el bloque REVOKE/GRANT de H6).
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

COMMENT ON FUNCTION public._cotizaciones_sync_vigencia() IS
  'Ola 18: sincroniza fecha_vigencia/vigencia_dias con validez_propuesta (fuente única de verdad de la vigencia mostrada en detalle y PDF).';

DROP TRIGGER IF EXISTS trg_cotizaciones_sync_vigencia ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_sync_vigencia
BEFORE INSERT OR UPDATE OF validez_propuesta, vigencia_dias, fecha_vigencia
ON public.cotizaciones
FOR EACH ROW
EXECUTE FUNCTION public._cotizaciones_sync_vigencia();

-- Backfill: alinear las cotizaciones ya desincronizadas.
UPDATE public.cotizaciones
SET validez_propuesta = validez_propuesta
WHERE validez_propuesta IS NOT NULL
  AND validez_propuesta <> fecha_vigencia
  AND deleted_at IS NULL;
