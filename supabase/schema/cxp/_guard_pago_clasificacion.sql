-- AUD99/121: la tipificación nace con el pago y no se reclasifica como dinero.
-- SECURITY INVOKER: sólo compara OLD/NEW; no consulta ni amplía acceso.
CREATE OR REPLACE FUNCTION public._guard_pago_clasificacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.es_ajuste IS DISTINCT FROM OLD.es_ajuste THEN
    RAISE EXCEPTION 'LC_PAGO_CLASIFICACION_INMUTABLE: no se puede cambiar la clasificación monetaria de un pago existente'
      USING ERRCODE = 'P0001';
  END IF;
  -- Un lote es una agrupación monetaria. Conservar legado sin reescribirlo,
  -- pero nunca crear ni cambiar una asociación de ajuste con un lote.
  IF NEW.es_ajuste AND NEW.lote_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede incorporarse a un lote de pagos'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._guard_pago_clasificacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._guard_pago_clasificacion() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_pago_clasificacion ON public.pagos_proveedor;
CREATE TRIGGER trg_00_pago_clasificacion
BEFORE INSERT OR UPDATE OF es_ajuste, lote_id ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._guard_pago_clasificacion();
