-- AUD88/91/93: autoridad de forma, aplicación y valuación de cobros nuevos.
-- Sin backfill: los metadatos de REP/históricos no recalculan dinero.
CREATE OR REPLACE FUNCTION public.tg_pagos_factura_monto_convertido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc numeric;
  v_metodo text;
  v_forma text;
  v_dinero_cambia boolean := true;
  v_fiscal_cambia boolean;
BEGIN
  -- DELETE y baja lógica también pueden invalidar un REP enviado sin UUID aún.
  IF TG_OP = 'DELETE' THEN
    IF OLD.facturapi_rep_id LIKE 'PENDING:%' THEN
      RAISE EXCEPTION 'LC_PAGO_REP_EN_PROCESO: no se puede eliminar un cobro mientras se timbra el REP'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_dinero_cambia := NEW.factura_id IS DISTINCT FROM OLD.factura_id
      OR NEW.monto IS DISTINCT FROM OLD.monto
      OR NEW.moneda IS DISTINCT FROM OLD.moneda
      OR NEW.tipo_cambio IS DISTINCT FROM OLD.tipo_cambio
      OR NEW.monto_aplicado_factura IS DISTINCT FROM OLD.monto_aplicado_factura
      OR NEW.diferencia_cambiaria_mxn IS DISTINCT FROM OLD.diferencia_cambiaria_mxn
      OR OLD.deleted_at IS NOT NULL;
    v_fiscal_cambia := v_dinero_cambia
      OR NEW.forma_pago IS DISTINCT FROM OLD.forma_pago
      OR NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.referencia IS DISTINCT FROM OLD.referencia
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at;
    IF v_fiscal_cambia AND OLD.facturapi_rep_id LIKE 'PENDING:%' THEN
      RAISE EXCEPTION 'LC_PAGO_REP_EN_PROCESO: no se pueden editar los datos fiscales o eliminar el cobro mientras se timbra el REP'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_fiscal_cambia AND OLD.uuid_rep IS NOT NULL AND OLD.estado_rep = 'Timbrado' THEN
      RAISE EXCEPTION 'LC_PAGO_CON_REP_VIVO: cancela el REP antes de editar los datos fiscales del cobro'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NOT v_dinero_cambia AND NEW.forma_pago IS NOT DISTINCT FROM OLD.forma_pago THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  -- Serializa con el resto de cobros/NC antes de leer la valuación documental.
  SELECT moneda, tipo_cambio, metodo_pago INTO v_fact_moneda, v_fact_tc, v_metodo
  FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;
  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_NO_ENCONTRADA: factura % no existe', NEW.factura_id USING ERRCODE = 'P0002';
  END IF;
  v_forma := lower(btrim(COALESCE(NEW.forma_pago, '')));
  IF v_metodo = 'PPD' AND NOT (v_forma = ANY(ARRAY[
    '01','02','03','04','05','06','08','12','13','14','15','17','23','24','25','26','27','28','29','30','31',
    'transferencia','transfer','cheque','efectivo','tarjeta','tarjeta de crédito','tarjeta de credito','tarjeta de débito','tarjeta de debito'
  ])) THEN
    RAISE EXCEPTION 'LC_PAGO_FORMA_REP_INVALIDA: capture la forma efectiva del cobro PPD; 99 (Por definir) no es válida para REP'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_dinero_cambia THEN RETURN NEW; END IF;

  IF NEW.monto IS NULL OR NEW.monto <= 0 OR NEW.monto::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'LC_PAGO_MONTO_INVALIDO: el importe recibido debe ser finito y mayor a cero'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Mismo USD/USD conserva factor de aplicación 1, pero NO valuación MXN 1.
  IF (NEW.moneda <> 'MXN' OR v_fact_moneda <> 'MXN')
     AND (NEW.tipo_cambio IS NULL OR NEW.tipo_cambio NOT BETWEEN 5 AND 40
          OR NEW.tipo_cambio::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'LC_PAGO_TC_NO_VERIFICABLE: capture la valuación del cobro (5 a 40 MXN por divisa), incluso si la factura está en la misma moneda'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.monto_aplicado_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio, v_fact_moneda, v_fact_tc);

  -- MXN recibido menos la baja del activo al TC de emisión, a cuatro decimales.
  -- La entrada del cliente nunca es autoridad sobre este cálculo.
  IF v_fact_moneda <> 'MXN' THEN
    IF v_fact_tc IS NULL OR v_fact_tc <= 1 OR v_fact_tc::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'LC_PAGO_TC_FACTURA_NO_VERIFICABLE: la factura necesita su valuación de emisión para calcular la diferencia realizada'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.diferencia_cambiaria_mxn := round(
      NEW.monto * CASE WHEN NEW.moneda = 'MXN' THEN 1 ELSE NEW.tipo_cambio END
      - NEW.monto_aplicado_factura * v_fact_tc, 4);
  ELSE
    NEW.diferencia_cambiaria_mxn := 0;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_pagos_factura_monto_convertido() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tg_pagos_factura_monto_convertido() TO authenticated, service_role;

-- Una escritura directa de los derivados o una restauración tampoco elude el canon.
DROP TRIGGER IF EXISTS trg_pagos_factura_monto_convertido ON public.pagos_factura;
CREATE TRIGGER trg_pagos_factura_monto_convertido
BEFORE INSERT OR DELETE OR UPDATE OF monto, moneda, tipo_cambio, factura_id, monto_aplicado_factura,
  diferencia_cambiaria_mxn, forma_pago, fecha_pago, created_at, referencia, deleted_at ON public.pagos_factura
FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_factura_monto_convertido();
