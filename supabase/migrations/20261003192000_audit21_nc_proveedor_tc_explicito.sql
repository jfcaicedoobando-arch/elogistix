-- Auditoría 21: el TC explícito positivo es el mismo del preview y la NC.
-- Sólo un TC omitido (NULL) solicita la paridad DOF. Sin reparación histórica.
CREATE OR REPLACE FUNCTION public._nc_prov_tc_moneda_convertible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda_factura text;
  v_moneda_ext text;
  v_fecha date;
  v_tc numeric;
BEGIN
  SELECT pf.moneda::text INTO v_moneda_factura
  FROM public.proveedor_facturas pf
  WHERE pf.id = NEW.proveedor_factura_id;

  IF v_moneda_factura IS NULL OR NEW.moneda::text = v_moneda_factura THEN
    NEW.tipo_cambio := NULL;
    RETURN NEW;
  END IF;
  IF NEW.moneda::text <> 'MXN' AND v_moneda_factura <> 'MXN' THEN
    RAISE EXCEPTION 'LC_NC_PROV_MONEDA_NO_CONVERTIBLE: no hay tipo de cambio cruzado entre % y %; captura la nota de crédito en % o en MXN',
      NEW.moneda, v_moneda_factura, v_moneda_factura
      USING ERRCODE = '22023';
  END IF;

  IF NEW.tipo_cambio IS NOT NULL THEN
    IF NEW.tipo_cambio <= 0 OR NEW.tipo_cambio::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: el tipo de cambio capturado debe ser finito y mayor a cero'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  v_moneda_ext := CASE WHEN NEW.moneda::text = 'MXN' THEN v_moneda_factura ELSE NEW.moneda::text END;
  v_fecha := COALESCE(NEW.fecha, (now() AT TIME ZONE 'America/Mexico_City')::date);
  SELECT CASE
           WHEN v_moneda_ext = 'USD' THEN d.usd_mxn
           WHEN v_moneda_ext = 'EUR' THEN d.eur_mxn
         END
    INTO v_tc
  FROM public.tc_dof_vigente(v_fecha) d;
  IF v_tc IS NULL OR v_tc <= 0 OR v_tc::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_REQUERIDO: falta tipo de cambio DOF para % al %; captúralo antes de registrar la nota de crédito',
      v_moneda_ext, v_fecha
      USING ERRCODE = '22023';
  END IF;
  NEW.tipo_cambio := v_tc;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._nc_prov_tc_moneda_convertible() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._nc_prov_tc_moneda_convertible() FROM anon;
REVOKE ALL ON FUNCTION public._nc_prov_tc_moneda_convertible() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._nc_prov_tc_moneda_convertible() TO service_role;
