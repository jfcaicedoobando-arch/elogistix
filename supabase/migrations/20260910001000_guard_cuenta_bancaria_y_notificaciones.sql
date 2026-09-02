-- Ronda YAGNI: defecto 3 (baja de cuenta bancaria con movimientos) y
-- defecto 8 (columnas editables de notificaciones internas).

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

COMMENT ON FUNCTION public._cuenta_bancaria_guard_baja() IS
  'Ronda YAGNI defecto 3 — rechaza baja/soft-delete de cuentas bancarias con movimientos históricos.';

REVOKE ALL ON FUNCTION public._cuenta_bancaria_guard_baja() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cuenta_bancaria_guard_baja ON public.cuentas_bancarias;
CREATE TRIGGER trg_cuenta_bancaria_guard_baja
  BEFORE UPDATE ON public.cuentas_bancarias
  FOR EACH ROW
  EXECUTE FUNCTION public._cuenta_bancaria_guard_baja();

-- Defecto 8: los usuarios sólo pueden marcar leída una notificación interna.
REVOKE ALL ON public.notificaciones_internas FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.notificaciones_internas FROM authenticated;
GRANT SELECT ON public.notificaciones_internas TO authenticated;
GRANT UPDATE (leida, leida_at) ON public.notificaciones_internas TO authenticated;
GRANT ALL ON public.notificaciones_internas TO service_role;

-- H6: permisos explícitos del trigger (sólo el motor lo ejecuta).
GRANT EXECUTE ON FUNCTION public._cuenta_bancaria_guard_baja() TO service_role;
