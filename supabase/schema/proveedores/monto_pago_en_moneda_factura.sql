-- Canonical schema para public.monto_pago_en_moneda_factura (Ola 12 · R3P-01, migración 20260823100100).
-- Convierte un pago a la moneda de la factura. Sin tipo de cambio con monedas
-- distintas devuelve NULL: el llamador excluye el pago del saldo y marca
-- flujo_incompleto (nunca 1:1 silencioso, clase BL-04/RBD-07).
CREATE OR REPLACE FUNCTION public.monto_pago_en_moneda_factura(
  p_monto numeric,
  p_moneda_pago text,
  p_tc_pago numeric,
  p_moneda_factura text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_factura THEN RETURN p_monto; END IF;
  IF COALESCE(p_tc_pago, 0) <= 0 THEN RETURN NULL; END IF;
  IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / p_tc_pago, 4); END IF;
  IF p_moneda_factura = 'MXN' THEN RETURN round(p_monto * p_tc_pago, 4); END IF;
  -- Cruce USD<->EUR: pagos_proveedor no almacena TC cruzado; se excluye.
  RETURN NULL;
END;
$function$;
