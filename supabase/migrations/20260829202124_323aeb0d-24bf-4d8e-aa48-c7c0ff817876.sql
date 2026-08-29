-- R-2: la sobrecarga de 5 argumentos quedó huérfana (la app siempre manda
-- p_contenedores). Dos firmas con DEFAULTs hacen ambigua la resolución.
DROP FUNCTION IF EXISTS public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid);

-- M-14: el trigger es compartido por pagos_factura (tipo_cambio) y
-- pagos_proveedor (tipo_cambio_usd). Referenciar NEW.<campo> directamente
-- falla en la tabla que no tiene esa columna, porque plpgsql resuelve todos
-- los campos del CASE aunque la rama no se ejecute. Se lee vía to_jsonb.
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_tc numeric;
  v_moneda text := v_row->>'moneda';
BEGIN
  v_tc := COALESCE(
    NULLIF(v_row->>'tipo_cambio_usd', '')::numeric,
    NULLIF(v_row->>'tipo_cambio', '')::numeric
  );
  IF v_moneda IS NOT NULL AND v_moneda <> 'MXN'
     AND v_tc IS NOT NULL AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION
      'LC_TC_FUERA_DE_BANDA: el tipo de cambio (%) está fuera de la banda razonable (5 a 40 MXN por divisa).',
      v_tc
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC, anon, authenticated;