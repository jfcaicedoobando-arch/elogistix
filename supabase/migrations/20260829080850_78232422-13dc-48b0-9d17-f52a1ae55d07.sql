-- B-4 (auditoría v14-2): PUE admite abonos parciales; fiscalmente PUE exige
-- una sola exhibición. Candado a nivel BD para cubrir registro individual,
-- cobro en lote y cualquier vía de API.

CREATE OR REPLACE FUNCTION public._assert_pago_pue_exhibicion_unica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_metodo text;
  v_total  numeric;
  v_otros  integer;
BEGIN
  SELECT f.metodo_pago, f.total
    INTO v_metodo, v_total
    FROM public.facturas f
   WHERE f.id = NEW.factura_id;

  -- Factura inexistente (lo resuelve la FK) o PPD: sin restricción extra.
  IF NOT FOUND OR v_metodo IS DISTINCT FROM 'PUE' THEN
    RETURN NEW;
  END IF;

  -- Una sola exhibición: no puede coexistir con otro pago vivo de la factura.
  SELECT count(*) INTO v_otros
    FROM public.pagos_factura p
   WHERE p.factura_id = NEW.factura_id
     AND p.deleted_at IS NULL
     AND p.id IS DISTINCT FROM NEW.id;
  IF v_otros > 0 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_EXHIBICION_UNICA: la factura es PUE y ya tiene un pago registrado; PUE exige liquidar en una sola exhibición. Cancela el pago previo si fue un error.'
      USING ERRCODE = 'P0001';
  END IF;

  -- El pago debe liquidar el total de la factura (tolerancia 0.05 por redondeo).
  IF COALESCE(NEW.monto_aplicado_factura, NEW.monto) < v_total - 0.05 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL: la factura es PUE; registra el cobro por el total (%) en una sola exhibición. Si el cliente abona, cambia la factura a PPD.', v_total
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() FROM anon;
REVOKE ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() FROM authenticated;
GRANT ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() TO service_role;

DROP TRIGGER IF EXISTS trg_pago_pue_exhibicion_unica ON public.pagos_factura;
CREATE TRIGGER trg_pago_pue_exhibicion_unica
BEFORE INSERT OR UPDATE OF factura_id, monto, monto_aplicado_factura ON public.pagos_factura
FOR EACH ROW EXECUTE FUNCTION public._assert_pago_pue_exhibicion_unica();