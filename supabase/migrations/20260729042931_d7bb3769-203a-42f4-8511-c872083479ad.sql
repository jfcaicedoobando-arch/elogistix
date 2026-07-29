-- FIX C4: los totales de la factura se re-derivan en el servidor desde sus conceptos.
CREATE OR REPLACE FUNCTION public.recalc_factura_retenciones(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_isr numeric;
  v_iva_ret numeric;
  v_subtotal numeric;
  v_iva numeric;
  v_conceptos int;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(monto_ret_isr), 0),
    COALESCE(SUM(monto_ret_iva), 0),
    COALESCE(SUM(total), 0),
    COALESCE(SUM(ROUND(total * COALESCE(tasa_iva_aplicada, 0), 2)), 0)
  INTO v_conceptos, v_isr, v_iva_ret, v_subtotal, v_iva
  FROM public.conceptos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  IF v_conceptos = 0 THEN
    -- Factura sin conceptos (histórica o en construcción): sólo limpiamos retenciones.
    UPDATE public.facturas
      SET ret_isr = 0,
          ret_iva = 0,
          total = COALESCE(subtotal, 0) + COALESCE(iva, 0),
          updated_at = now()
      WHERE id = p_factura_id;
    RETURN;
  END IF;

  UPDATE public.facturas
    SET subtotal = v_subtotal,
        iva = v_iva,
        ret_isr = v_isr,
        ret_iva = v_iva_ret,
        total = v_subtotal + v_iva - v_isr - v_iva_ret,
        updated_at = now()
    WHERE id = p_factura_id;
END;
$function$;

COMMENT ON FUNCTION public.recalc_factura_retenciones(uuid) IS
  'C4: recalcula subtotal, IVA, retenciones y total de una factura desde sus conceptos vivos.';