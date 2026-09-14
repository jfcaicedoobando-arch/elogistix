-- Fuente canónica de public._bbva_guard_movimiento_manual() (N3 · v13.823.386).
-- 1:1 con supabase/migrations/20260914190057_51646384-f9a6-4ce8-9bca-b065da917dc7.sql.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

-- N3 (v13.823.386): candado de fecha para movimientos bancarios capturados a
-- mano (hash_dedupe LIKE 'manual-%'). Antes la captura manual sólo exigía que
-- la fecha existiera: una fecha futura alteraba el saldo y el flujo de hoy, y
-- una anterior al corte quedaba fuera del saldo inicial de la cuenta.
-- No aplica a importaciones históricas ni a movimientos de sistema.
CREATE OR REPLACE FUNCTION public._bbva_guard_movimiento_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corte date;
BEGIN
  IF COALESCE(NEW.hash_dedupe, '') NOT LIKE 'manual-%' THEN
    RETURN NEW;
  END IF;

  IF NEW.fecha IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_MANUAL_FECHA_REQUERIDA: captura la fecha del movimiento bancario'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.fecha > public.fecha_negocio_mx() THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_MANUAL_FECHA_FUTURA: la fecha del movimiento (%) no puede ser futura', NEW.fecha
      USING ERRCODE = '22023';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT cb.fecha_saldo_inicial INTO v_corte
    FROM public.cuentas_bancarias cb
    WHERE cb.id = NEW.cuenta_bancaria_id;

    IF v_corte IS NOT NULL AND NEW.fecha < v_corte THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MANUAL_FECHA_ANTES_CORTE: la fecha del movimiento (%) es anterior al corte de saldo inicial de la cuenta (%)', NEW.fecha, v_corte
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._bbva_guard_movimiento_manual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._bbva_guard_movimiento_manual() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_bbva_guard_movimiento_manual ON public.bbva_movimientos;
CREATE TRIGGER trg_bbva_guard_movimiento_manual
BEFORE INSERT OR UPDATE OF fecha ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION public._bbva_guard_movimiento_manual();

