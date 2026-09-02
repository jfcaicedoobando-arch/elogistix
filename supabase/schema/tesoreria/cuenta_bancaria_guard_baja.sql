-- Espejo: guard de baja de cuentas bancarias con movimientos históricos.
-- Ronda YAGNI (defecto 3): la baja/soft-delete de una cuenta con movimientos
-- se rechaza en el servidor; el precheck de UI sólo sirve para el mensaje.
CREATE OR REPLACE FUNCTION public._cuenta_bancaria_guard_baja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_baja boolean;
BEGIN
  v_baja := (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
         OR (NEW.activa IS FALSE AND OLD.activa IS TRUE);

  IF v_baja AND EXISTS (
    SELECT 1 FROM public.bbva_movimientos m
     WHERE m.cuenta_bancaria_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'LC_CUENTA_CON_MOVIMIENTOS: la cuenta bancaria tiene movimientos históricos y no puede darse de baja ni eliminarse.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cuenta_bancaria_guard_baja ON public.cuentas_bancarias;
CREATE TRIGGER trg_cuenta_bancaria_guard_baja
  BEFORE UPDATE ON public.cuentas_bancarias
  FOR EACH ROW
  EXECUTE FUNCTION public._cuenta_bancaria_guard_baja();
