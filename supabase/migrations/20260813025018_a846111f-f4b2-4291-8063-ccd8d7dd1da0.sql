-- Ola 11 · RNF-10: el bloqueo "no cambiar moneda si la cuenta tiene
-- movimientos" vivía sólo en el cliente (check-then-act): bypass por API REST
-- o carrera contra una importación concurrente mezclaban divisas en el saldo
-- derivado. Ahora la invariante vive en la base.
CREATE OR REPLACE FUNCTION public.guard_cuenta_bancaria_moneda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.moneda IS DISTINCT FROM OLD.moneda
     AND EXISTS (
       SELECT 1 FROM public.bbva_movimientos
       WHERE cuenta_bancaria_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'LC_CUENTA_MONEDA_CON_MOVIMIENTOS: La cuenta ya tiene movimientos registrados en %; la moneda no se puede cambiar.',
      OLD.moneda
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_cuenta_bancaria_moneda() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_cuenta_bancaria_moneda() FROM anon;

DROP TRIGGER IF EXISTS trg_cuentas_bancarias_moneda_guard ON public.cuentas_bancarias;
CREATE TRIGGER trg_cuentas_bancarias_moneda_guard
  BEFORE UPDATE OF moneda ON public.cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.guard_cuenta_bancaria_moneda();