CREATE OR REPLACE FUNCTION public._recalc_estado_proveedor_factura(p_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_captura text;
  v_saldo  numeric;
  v_nuevo  text;
  v_nueva_captura text;
BEGIN
  SELECT estado::text, estado_captura
    INTO v_estado, v_captura
  FROM public.proveedor_facturas
  WHERE id = p_factura_id;

  IF v_estado IS NULL THEN RETURN; END IF;
  IF v_estado IN ('Cancelada','Borrador') THEN RETURN; END IF;

  SELECT COALESCE(saldo, 0) INTO v_saldo
  FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = p_factura_id;

  IF v_saldo IS NULL THEN v_saldo := 0; END IF;

  IF v_saldo <= 0.01 THEN v_nuevo := 'Pagada'; ELSE v_nuevo := 'Vigente'; END IF;

  -- R2-32: sincroniza estado_captura con el estado financiero
  IF v_nuevo = 'Pagada' THEN
    v_nueva_captura := 'pagada';
  ELSIF v_captura = 'pagada' THEN
    -- Reabrió saldo: retrocede de 'pagada' → 'capturada'
    v_nueva_captura := 'capturada';
  ELSE
    v_nueva_captura := v_captura;
  END IF;

  IF v_nuevo IS DISTINCT FROM v_estado
     OR v_nueva_captura IS DISTINCT FROM v_captura THEN
    PERFORM set_config('app.recalc_cxp','1', true);
    BEGIN
      UPDATE public.proveedor_facturas
         SET estado         = v_nuevo::estado_proveedor_factura,
             estado_captura = v_nueva_captura,
             updated_at     = now()
       WHERE id = p_factura_id
         AND (estado::text IS DISTINCT FROM v_nuevo
              OR estado_captura IS DISTINCT FROM v_nueva_captura);
      PERFORM set_config('app.recalc_cxp','0', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.recalc_cxp','0', true);
      RAISE;
    END;
  END IF;
END;
$function$

