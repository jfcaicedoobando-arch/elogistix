-- Audit134: select the persisted application amount without reconstructing FX.
-- Direct payments retain monto_pago_en_moneda_factura and its existing semantics.
-- NULL on an applied advance means unknown, even when a separate rate exists.
CREATE OR REPLACE FUNCTION public.monto_pago_proveedor_en_moneda_factura(
  p_es_anticipo_aplicado boolean,
  p_monto_en_moneda_factura numeric,
  p_monto numeric,
  p_moneda_pago text,
  p_tc_pago numeric,
  p_moneda_factura text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p_es_anticipo_aplicado THEN p_monto_en_moneda_factura
    ELSE public.monto_pago_en_moneda_factura(
      p_monto, p_moneda_pago, p_tc_pago, p_moneda_factura)
  END;
$function$;

REVOKE ALL ON FUNCTION public.monto_pago_proveedor_en_moneda_factura(boolean, numeric, numeric, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monto_pago_proveedor_en_moneda_factura(boolean, numeric, numeric, text, numeric, text) TO authenticated, service_role;
