-- M-14 (ajuste): un pago en la misma moneda que la factura usa factor 1, que
-- es legítimo. La banda 5–40 sólo aplica cuando hay conversión real de moneda.
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_tc numeric;
  v_moneda text := v_row->>'moneda';
  v_moneda_doc text;
BEGIN
  v_tc := COALESCE(
    NULLIF(v_row->>'tipo_cambio_usd', '')::numeric,
    NULLIF(v_row->>'tipo_cambio', '')::numeric
  );
  IF v_tc IS NULL OR v_moneda IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'pagos_proveedor' THEN
    SELECT pf.moneda::text INTO v_moneda_doc
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_row->>'proveedor_factura_id')::uuid;
  ELSE
    SELECT f.moneda::text INTO v_moneda_doc
    FROM public.facturas f
    WHERE f.id = (v_row->>'factura_id')::uuid;
  END IF;

  -- Sin conversión de moneda (pago y documento en la misma divisa) el factor
  -- neutro 1 es correcto y no se evalúa la banda.
  IF v_moneda_doc IS NOT NULL AND v_moneda_doc = v_moneda THEN
    RETURN NEW;
  END IF;

  IF (v_moneda <> 'MXN' OR COALESCE(v_moneda_doc, 'MXN') <> 'MXN')
     AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION
      'LC_TC_FUERA_DE_BANDA: el tipo de cambio (%) está fuera de la banda razonable (5 a 40 MXN por divisa).',
      v_tc
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC, anon, authenticated;