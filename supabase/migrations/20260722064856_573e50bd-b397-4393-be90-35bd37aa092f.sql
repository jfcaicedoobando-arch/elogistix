CREATE OR REPLACE FUNCTION public._recalc_estado_proveedor_factura(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_saldo  numeric;
  v_nuevo  text;
BEGIN
  SELECT estado::text INTO v_estado
  FROM public.proveedor_facturas
  WHERE id = p_factura_id;

  IF v_estado IS NULL THEN RETURN; END IF;
  IF v_estado IN ('Cancelada','Borrador') THEN RETURN; END IF;

  SELECT COALESCE(saldo, 0) INTO v_saldo
  FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = p_factura_id;

  IF v_saldo IS NULL THEN v_saldo := 0; END IF;

  IF v_saldo <= 0.01 THEN v_nuevo := 'Pagada'; ELSE v_nuevo := 'Vigente'; END IF;

  IF v_nuevo IS DISTINCT FROM v_estado THEN
    -- Marca de sesión para que el guard permita la transición saliente de 'Pagada'
    -- cuando el recálculo interno reabre saldo (pago borrado, NC aplicada, etc.).
    PERFORM set_config('app.recalc_cxp','1', true);
    BEGIN
      UPDATE public.proveedor_facturas
         SET estado = v_nuevo::estado_proveedor_factura,
             updated_at = now()
       WHERE id = p_factura_id
         AND estado::text IS DISTINCT FROM v_nuevo;
      PERFORM set_config('app.recalc_cxp','0', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.recalc_cxp','0', true);
      RAISE;
    END;
  END IF;
END;
$$;