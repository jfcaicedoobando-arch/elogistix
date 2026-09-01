-- Canonical schema para public.a_mxn.
-- Valúa un importe a MXN con el TC DOF recibido. Sin TC válido para la divisa
-- devuelve NULL: quien suma lo excluye y avisa (nunca paridad 1:1).
-- Regenerada 1:1 desde la definición vigente (migración 20260905000100, regla M-8).
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.a_mxn(p_monto numeric, p_moneda text, p_usd_mxn numeric, p_eur_mxn numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL THEN NULL
    WHEN p_moneda = 'MXN' THEN p_monto
    -- M-8: > 1 (no > 0). En México el T/C se maneja como pesos por dólar/euro,
    -- así que 1 o menos nunca es un tipo de cambio real.
    WHEN p_moneda = 'USD' AND COALESCE(p_usd_mxn, 0) > 1 THEN round(p_monto * p_usd_mxn, 4)
    WHEN p_moneda = 'EUR' AND COALESCE(p_eur_mxn, 0) > 1 THEN round(p_monto * p_eur_mxn, 4)
    ELSE NULL
  END
$function$
;
