CREATE OR REPLACE FUNCTION public._factura_serie_folio_monotonico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tiene_facturas boolean;
BEGIN
  IF NEW.folio_actual < OLD.folio_actual THEN
    RAISE EXCEPTION 'LC_FOLIO_NO_REGRESIVO: el folio de la serie % no puede retroceder (% -> %)',
      OLD.codigo, OLD.folio_actual, NEW.folio_actual;
  END IF;

  IF NEW.prefijo IS DISTINCT FROM OLD.prefijo
     OR NEW.folio_inicial IS DISTINCT FROM OLD.folio_inicial THEN
    SELECT EXISTS (SELECT 1 FROM public.facturas f WHERE f.serie_id = OLD.id)
      INTO v_tiene_facturas;
    IF v_tiene_facturas THEN
      RAISE EXCEPTION 'LC_SERIE_INMUTABLE: la serie % ya tiene facturas; no se puede cambiar su prefijo ni su folio inicial',
        OLD.codigo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._factura_serie_folio_monotonico() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._factura_serie_folio_monotonico() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._factura_serie_folio_monotonico() TO service_role;

DROP TRIGGER IF EXISTS trg_factura_serie_folio_monotonico ON public.factura_series;
CREATE TRIGGER trg_factura_serie_folio_monotonico
BEFORE UPDATE ON public.factura_series
FOR EACH ROW
EXECUTE FUNCTION public._factura_serie_folio_monotonico();