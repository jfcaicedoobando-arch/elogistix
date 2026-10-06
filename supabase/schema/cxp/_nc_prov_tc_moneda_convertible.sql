CREATE OR REPLACE FUNCTION public._nc_prov_tc_moneda_convertible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda_factura text;
  v_moneda_ext text;
  v_tc numeric;
BEGIN
  -- No-op fiscal: no consultar DOF ni completar metadatos de una NC histórica.
  IF TG_OP = 'UPDATE' AND ROW(NEW.monto, NEW.subtotal, NEW.moneda,
      NEW.tipo_cambio, NEW.tipo_cambio_mxn, NEW.fecha, NEW.proveedor_factura_id)
    IS NOT DISTINCT FROM ROW(OLD.monto, OLD.subtotal, OLD.moneda,
      OLD.tipo_cambio, OLD.tipo_cambio_mxn, OLD.fecha, OLD.proveedor_factura_id) THEN
    RETURN NEW;
  END IF;
  -- Toda NC nueva requiere base explícita. Una edición fiscal tampoco puede
  -- eliminar la base; un UPDATE de otro campo no repara ni cambia históricos.
  IF TG_OP = 'INSERT' OR NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
    IF NEW.subtotal IS NULL OR NEW.subtotal < 0
       OR NEW.subtotal::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'LC_NC_PROV_BASE_REQUERIDA: captura la base sin impuestos de la nota de crédito'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado <> 'Borrador' AND (
      NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.tipo_cambio_mxn IS DISTINCT FROM OLD.tipo_cambio_mxn) THEN
    RAISE EXCEPTION 'LC_NC_PROV_DESGLOSE_INMUTABLE: no se cambia la base ni valuación de una NC aprobada'
      USING ERRCODE = '22023';
  END IF;

  SELECT pf.moneda::text INTO v_moneda_factura
  FROM public.proveedor_facturas pf WHERE pf.id = NEW.proveedor_factura_id;

  IF NEW.moneda::text <> v_moneda_factura
     AND NEW.moneda::text <> 'MXN' AND v_moneda_factura <> 'MXN' THEN
    RAISE EXCEPTION 'LC_NC_PROV_MONEDA_NO_CONVERTIBLE: no hay tipo de cambio cruzado entre % y %', NEW.moneda, v_moneda_factura
      USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cambio IS NOT NULL AND (NEW.tipo_cambio <= 0
      OR NEW.tipo_cambio::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: el tipo de cambio capturado debe ser finito y mayor a cero'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cambio_mxn IS NOT NULL AND (NEW.tipo_cambio_mxn <= 0
      OR NEW.tipo_cambio_mxn::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: la valuación MXN debe ser finita y mayor a cero'
      USING ERRCODE = '22023';
  END IF;

  v_moneda_ext := CASE WHEN NEW.moneda::text = 'MXN' THEN v_moneda_factura ELSE NEW.moneda::text END;
  -- Un único valor de mercado por divisa, preservando cualquier paridad explícita.
  IF NEW.moneda::text <> v_moneda_factura THEN
    v_tc := COALESCE(NEW.tipo_cambio, CASE WHEN NEW.moneda::text <> 'MXN' THEN NEW.tipo_cambio_mxn END);
  ELSIF NEW.moneda::text <> 'MXN' THEN
    v_tc := NEW.tipo_cambio_mxn;
  END IF;
  IF v_moneda_ext <> 'MXN' AND v_tc IS NULL THEN
    SELECT CASE WHEN v_moneda_ext = 'USD' THEN d.usd_mxn WHEN v_moneda_ext = 'EUR' THEN d.eur_mxn END
      INTO v_tc FROM public.tc_dof_vigente(NEW.fecha) d;
    IF v_tc IS NULL OR v_tc <= 0 OR v_tc::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_REQUERIDO: captura la valuación MXN de % para la fecha de la NC', v_moneda_ext
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.moneda::text = 'MXN' THEN
    IF NEW.tipo_cambio_mxn IS NOT NULL AND NEW.tipo_cambio_mxn <> 1 THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: una NC MXN se valúa a 1 MXN';
    END IF;
    NEW.tipo_cambio_mxn := 1;
  ELSE
    NEW.tipo_cambio_mxn := COALESCE(NEW.tipo_cambio_mxn, v_tc);
    IF NEW.moneda::text <> v_moneda_factura AND NEW.tipo_cambio_mxn <> v_tc THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_INCONSISTENTE: la valuación MXN y conversión a deuda deben coincidir para esta divisa';
    END IF;
  END IF;
  -- La identidad EUR/EUR (o USD/USD) nunca multiplica la deuda por su valuación.
  NEW.tipo_cambio := CASE WHEN NEW.moneda::text = v_moneda_factura THEN NULL ELSE v_tc END;
  -- La normalización también cuenta como cambio: no inferir valuación de una
  -- NC aprobada/aplicada cuyo desglose histórico sigue desconocido.
  IF TG_OP = 'UPDATE' AND OLD.estado <> 'Borrador' AND (
      NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.tipo_cambio_mxn IS DISTINCT FROM OLD.tipo_cambio_mxn) THEN
    RAISE EXCEPTION 'LC_NC_PROV_DESGLOSE_INMUTABLE: no se cambia la base ni valuación de una NC aprobada'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
