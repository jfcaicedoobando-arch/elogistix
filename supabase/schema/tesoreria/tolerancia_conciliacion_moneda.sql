-- Fuente canónica de public.tolerancia_conciliacion_moneda(text).
-- 1:1 con supabase/migrations/20260917182140_3783eacb-667c-4501-b6f6-b175b44e3bd8.sql.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.tolerancia_conciliacion_moneda(p_moneda text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(btrim(COALESCE(p_moneda, '')))
           WHEN 'MXN' THEN 1.00
           WHEN 'USD' THEN 0.05
           WHEN 'EUR' THEN 0.05
           ELSE 0        -- moneda desconocida ⇒ coincidencia exacta
         END::numeric
$$;

REVOKE ALL ON FUNCTION public.tolerancia_conciliacion_moneda(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tolerancia_conciliacion_moneda(text) TO authenticated, service_role;
