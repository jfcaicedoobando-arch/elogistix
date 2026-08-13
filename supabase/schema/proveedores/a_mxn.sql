-- Canonical schema para public.a_mxn (Ola 12 · R3FE-01, migración 20260823100100).
-- Valúa un importe a MXN con el TC DOF recibido. Sin TC para la divisa
-- devuelve NULL: quien suma lo excluye y avisa (nunca paridad 1:1).
CREATE OR REPLACE FUNCTION public.a_mxn(
  p_monto numeric,
  p_moneda text,
  p_usd_mxn numeric,
  p_eur_mxn numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL THEN NULL
    WHEN p_moneda = 'MXN' THEN p_monto
    WHEN p_moneda = 'USD' AND COALESCE(p_usd_mxn, 0) > 0 THEN round(p_monto * p_usd_mxn, 4)
    WHEN p_moneda = 'EUR' AND COALESCE(p_eur_mxn, 0) > 0 THEN round(p_monto * p_eur_mxn, 4)
    ELSE NULL
  END
$function$;
