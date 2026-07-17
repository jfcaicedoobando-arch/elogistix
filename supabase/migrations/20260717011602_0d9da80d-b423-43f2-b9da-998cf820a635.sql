CREATE OR REPLACE FUNCTION public.check_factura_saldo_para_nc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric;
  v_estado text;
BEGIN
  SELECT saldo, estado INTO v_saldo, v_estado
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_saldo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sólo aplica a facturas vigentes (Emitida). Borradores/canceladas no llegan aquí normalmente.
  IF v_estado = 'Emitida' AND v_saldo <= 0.01 THEN
    RAISE EXCEPTION 'FACTURA_LIQUIDADA_SIN_NC: La factura ya está liquidada (saldo = %). No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.', v_saldo
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_factura_saldo_para_nc ON public.factura_notas_credito;
CREATE TRIGGER trg_check_factura_saldo_para_nc
BEFORE INSERT ON public.factura_notas_credito
FOR EACH ROW
EXECUTE FUNCTION public.check_factura_saldo_para_nc();