-- Candado: una factura con cancelación en trámite ante el SAT no admite pagos.
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
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
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

  -- Nuevo: trámite de cancelación en curso (pending/verifying) ⇒ sin cobros.
  IF v_cancel IN ('pending','verifying') THEN
    RAISE EXCEPTION 'LC_FACTURA_EN_CANCELACION: la factura tiene una cancelación en trámite ante el SAT y no admite cobros'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('cancellation_status', v_cancel)::text;
  END IF;

  -- Pagos vivos EXCLUYENDO la fila actual (INSERT o UPDATE del mismo id).
  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- FIX-08: restar NCs aplicadas (mismo conjunto canónico que public.saldo_factura).
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

COMMENT ON FUNCTION public.assert_factura_viva_para_pago() IS
'FIX-08/23 + LC_FACTURA_EN_CANCELACION: valida estado vivo, ausencia de cancelación en trámite (pending/verifying) y que el pago no exceda el saldo neto, con lock sobre la factura padre.';