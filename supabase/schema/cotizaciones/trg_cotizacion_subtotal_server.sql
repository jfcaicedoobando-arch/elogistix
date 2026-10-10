-- Review mirror of 20261010163000_pricing_subtotal_moneda_canonica.sql.
-- The migration preserves the existing owner and ACL; this mirror is not a deployment.
CREATE OR REPLACE FUNCTION public.trg_cotizacion_subtotal_server()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_t record;
  v_n int;
  v_extranjero numeric;
BEGIN
  IF NEW.pricing_solicitud_id IS NOT NULL THEN
    IF NEW.moneda IS NULL OR NEW.moneda::text NOT IN ('USD', 'MXN') THEN
      RAISE EXCEPTION 'LC_COT_PRICING_MONEDA_INVALIDA' USING ERRCODE='22023';
    END IF;

    -- Existing canonical helper validates concepts and rounds each sales line
    -- before summing each currency. IVA never enters the header subtotal.
    SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
    IF v_t.subtotal_usd::text IN ('NaN','Infinity','-Infinity')
       OR v_t.subtotal_mxn::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: subtotal no finito'
        USING ERRCODE='23514';
    END IF;
    v_extranjero := CASE WHEN NEW.moneda::text='USD'
      THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END;

    IF v_extranjero <> 0 AND (NEW.tipo_cambio_usd IS NULL
       OR NEW.tipo_cambio_usd <= 0
       OR NEW.tipo_cambio_usd::text IN ('NaN','Infinity','-Infinity')) THEN
      RAISE EXCEPTION 'LC_COT_PRICING_TC_REQUERIDO' USING ERRCODE='22023';
    END IF;

    NEW.subtotal := ROUND(CASE WHEN NEW.moneda::text='USD'
      THEN v_t.subtotal_usd + CASE WHEN v_extranjero=0 THEN 0
                                 ELSE v_t.subtotal_mxn / NEW.tipo_cambio_usd END
      ELSE v_t.subtotal_mxn + CASE WHEN v_extranjero=0 THEN 0
                                 ELSE v_t.subtotal_usd * NEW.tipo_cambio_usd END
    END, 2);
    RETURN NEW;
  END IF;

  -- Unchanged legacy behavior for quotations without Pricing lineage.
  v_n := CASE WHEN jsonb_typeof(NEW.conceptos_venta) = 'array'
              THEN jsonb_array_length(NEW.conceptos_venta) ELSE 0 END;
  IF v_n = 0 THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
  NEW.subtotal := COALESCE(
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_usd ELSE v_t.subtotal_mxn END, 0),
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END, 0),
    0
  );
  RETURN NEW;
END;
$function$;
