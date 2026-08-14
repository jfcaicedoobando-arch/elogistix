CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_cancel text;
  v_total numeric;
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
  -- esté cancelada o con cancelación en trámite; de lo contrario la
  -- reconciliación queda bloqueada y la BD divergen del SAT.
  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  -- FIX-23: bloquear la factura padre para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0), COALESCE(cancellation_status, 'none')
    INTO v_estado, v_total, v_cancel
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

  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = NEW.factura_id
    AND deleted_at IS NULL
    AND estado = 'Aplicada';

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.01 THEN
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
