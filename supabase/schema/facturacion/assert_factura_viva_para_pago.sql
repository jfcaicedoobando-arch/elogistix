-- Fuente canónica de public.assert_factura_viva_para_pago() (trigger de pagos_factura).
-- Ola 1 (major release): notas de crédito CONVERTIDAS a la moneda de la factura
-- (canon public.nc_aplicadas_en_moneda_factura), tolerancia unificada en 0.005
-- (medio centavo, igual que tg_pago_factura_no_sobrepago) y guard de fecha
-- futura al alta del cobro (espejo de LC_LOTE_FECHA_FUTURA).
-- FIX3 (M-4): el guard de fecha futura cubre INSERT y UPDATE (fecha_pago sale
-- de la lista "sólo metadatos"), nueva regla LC_PAGO_FECHA_PREVIA_EMISION
-- (paridad con el lote CxC) y la función pasa a SECURITY DEFINER para poder
-- llamar al canon de NCs tras el REVOKE de los helpers a `authenticated`.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_cancel text;
  v_total numeric;
  v_fecha_emision date;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_saldo_disponible_previo numeric;
  v_saldo_post numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- FIX-63: un UPDATE que NO toca el dinero (p. ej. sincronizar el estatus del
  -- REP ante el SAT, adjuntar PDF/XML o marcar el acuse) es mantenimiento
  -- documental, no un cobro nuevo. Esos updates deben pasar aunque la factura
  -- esté cancelada o con cancelación en trámite.
  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      -- FIX3 (M-4): un cambio de fecha ya no es "sólo metadatos".
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Ola 1: espejo de LC_LOTE_FECHA_FUTURA (cobro en lote). Un cobro con fecha
  -- futura ensucia aging, REP y reportes de flujo.
  -- FIX3 (M-4): aplica también en UPDATE.
  IF NEW.fecha_pago IS NOT NULL AND NEW.fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del cobro no puede ser futura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('fecha_pago', NEW.fecha_pago)::text;
  END IF;

  -- FIX-23: bloquear la factura padre para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0), COALESCE(cancellation_status, 'none'),
         fecha_emision
    INTO v_estado, v_total, v_cancel, v_fecha_emision
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  IF v_cancel IN ('pending','verifying') THEN
    RAISE EXCEPTION 'LC_FACTURA_EN_CANCELACION: la factura tiene una cancelación en trámite ante el SAT y no admite cobros'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('cancellation_status', v_cancel)::text;
  END IF;

  -- FIX3 (M-4): paridad con el lote CxC — el cobro no puede ser anterior a la
  -- emisión de la factura. Facturas sin fecha_emision quedan fuera de la regla.
  IF NEW.fecha_pago IS NOT NULL
     AND v_fecha_emision IS NOT NULL
     AND NEW.fecha_pago < v_fecha_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del cobro no puede ser anterior a la emisión de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'fecha_pago', NEW.fecha_pago,
              'fecha_emision', v_fecha_emision
            )::text;
  END IF;

  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ola 1: NC convertidas a la moneda de la factura (antes SUM(monto) crudo).
  v_ncs := public.nc_aplicadas_en_moneda_factura(NEW.factura_id);

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_disponible_previo,
              'monto_intentado', NEW.monto_aplicado_factura,
              'notas_credito_aplicadas', v_ncs
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

-- FIX-45: ninguna función financiera es ejecutable por anon.
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM anon;
