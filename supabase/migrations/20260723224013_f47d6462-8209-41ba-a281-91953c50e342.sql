-- FIX schema-invariants: recrear triggers esperados que no existen en CI
-- (drift entre live DB y migraciones). Idempotente.

-- 1) trg_tracking_externo_updated: nunca se creó en una migración, sólo en prod.
DROP TRIGGER IF EXISTS trg_tracking_externo_updated ON public.tracking_externo;
CREATE TRIGGER trg_tracking_externo_updated
  BEFORE UPDATE ON public.tracking_externo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) trg_pago_factura_comision_ins: existe en migración origen 20260602193937,
-- pero re-creamos idempotentemente por si algún flujo lo eliminó.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'trg_pago_factura_comision'
  ) THEN
    DROP TRIGGER IF EXISTS trg_pago_factura_comision_ins ON public.pagos_factura;
    CREATE TRIGGER trg_pago_factura_comision_ins
      AFTER INSERT OR UPDATE ON public.pagos_factura
      FOR EACH ROW EXECUTE FUNCTION public.trg_pago_factura_comision();
  ELSE
    RAISE NOTICE 'trg_pago_factura_comision() no existe; se omite recreación del trigger.';
  END IF;
END $do$;
