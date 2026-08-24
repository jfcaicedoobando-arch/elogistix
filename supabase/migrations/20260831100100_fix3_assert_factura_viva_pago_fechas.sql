-- ============================================================================
-- FIX3 · M-4 (O1.12/B3): fecha de pago individual — guard extendido a UPDATE
--          y regla "no anterior a fecha_emision" de la factura.
-- ============================================================================
-- Hallazgos (review_ola1_seguridad.md #12 y B3):
--   · LC_PAGO_FECHA_FUTURA sólo se evaluaba en INSERT y `v_solo_metadatos`
--     no comparaba `fecha_pago` → `UPDATE pagos_factura SET fecha_pago =
--     <futura>` pasaba sin validación.
--   · La regla "el cobro no puede ser anterior a la emisión de la factura"
--     sólo existía en el lote (LC_COBRO_LOTE_FECHA_PREVIA_EMISION); el pago
--     individual quedaba sin ella.
--
-- Cambios sobre la versión vigente (20260821002602):
--   1. `v_solo_metadatos` ahora también compara `fecha_pago`: un UPDATE que
--      mueve la fecha YA NO es mantenimiento documental y se valida completo.
--   2. El guard de fecha futura aplica a INSERT y UPDATE.
--   3. Nueva regla LC_PAGO_FECHA_PREVIA_EMISION: fecha_pago < fecha_emision
--      de la factura → rechazo (paridad con el lote CxC). Si la factura no
--      tiene fecha_emision (NULL), la regla no aplica.
--   4. La función pasa a SECURITY DEFINER: es un guard de integridad que se
--      ejecuta desde el trigger de pagos_factura con el rol invocante
--      (authenticated) y llama internamente a
--      public.nc_aplicadas_en_moneda_factura(uuid), helper que esta tanda
--      revoca a `authenticated` (ver 20260831100200). Como DEFINER (owner =
--      rol de migraciones) la llamada interna sigue funcionando sin GRANT al
--      rol invocante. El comportamiento del guard no cambia: sigue validando
--      NEW contra la factura y los pagos previos.
--
-- Espejo canónico actualizado: supabase/schema/facturacion/assert_factura_viva_para_pago.sql
-- ============================================================================

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

  IF TG_OP = 'UPDATE' THEN
    -- FIX-63: un UPDATE que NO toca el dinero NI LA FECHA (p. ej. sincronizar
    -- el estatus del REP ante el SAT, adjuntar PDF/XML o marcar el acuse) es
    -- mantenimiento documental, no un cobro nuevo. Esos updates deben pasar
    -- aunque la factura esté cancelada o con cancelación en trámite.
    -- FIX3 (M-4): `fecha_pago` se añade a la comparación — antes un cambio de
    -- fecha se colaba como "sólo metadatos" y saltaba todos los guards (B3).
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  -- FIX3 (M-4): el guard de fecha futura ahora cubre INSERT y UPDATE
  -- (antes sólo INSERT; un UPDATE de fecha_pago lo evadía).
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

  -- FIX3 (M-4): paridad con el lote CxC (LC_COBRO_LOTE_FECHA_PREVIA_EMISION):
  -- un cobro individual tampoco puede ser anterior a la emisión de la factura
  -- (ensucia aging y REP). Facturas sin fecha_emision quedan fuera de la regla.
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

REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM anon;
