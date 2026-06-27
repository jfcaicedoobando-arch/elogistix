-- 1) Alinear el trigger con el bypass administrativo consistente del sistema.
CREATE OR REPLACE FUNCTION public.bloquear_conceptos_en_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT estado::text INTO v_estado
  FROM public.embarques
  WHERE id = COALESCE(NEW.embarque_id, OLD.embarque_id);

  IF v_estado = 'Cerrado' THEN
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND current_setting('app.auditoria_backfill_legacy', true) = 'on'
       AND OLD.estado_facturacion = 'pendiente'
       AND NEW.estado_facturacion = 'facturado'
       AND (to_jsonb(NEW) - 'estado_facturacion') = (to_jsonb(OLD) - 'estado_facturacion') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar ni modificar conceptos en un embarque Cerrado. Reabre el embarque antes de editar.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Vincular conceptos sueltos a su proforma cuando los totales cuadran por moneda.
DO $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);
  WITH conceptos_sueltos AS (
    SELECT embarque_id, moneda, SUM(total) AS suma
    FROM conceptos_venta
    WHERE proforma_id IS NULL AND deleted_at IS NULL AND estado_facturacion='pendiente'
    GROUP BY embarque_id, moneda
  ),
  match_usd AS (
    SELECT p.id AS proforma_id, p.embarque_id
    FROM proformas p
    JOIN conceptos_sueltos cs ON cs.embarque_id=p.embarque_id AND cs.moneda='USD'
    WHERE p.estado_proforma='pendiente' AND p.deleted_at IS NULL
      AND p.subtotal_usd > 0 AND ABS(p.subtotal_usd - cs.suma) < 0.5
  ),
  match_mxn AS (
    SELECT p.id AS proforma_id, p.embarque_id
    FROM proformas p
    JOIN conceptos_sueltos cs ON cs.embarque_id=p.embarque_id AND cs.moneda='MXN'
    WHERE p.estado_proforma='pendiente' AND p.deleted_at IS NULL
      AND p.subtotal_mxn > 0 AND ABS(p.subtotal_mxn - cs.suma) < 0.5
  )
  UPDATE conceptos_venta cv
  SET proforma_id = m.proforma_id,
      estado_facturacion = 'en_proforma'
  FROM (
    SELECT embarque_id, proforma_id, 'USD'::moneda AS moneda FROM match_usd
    UNION ALL
    SELECT embarque_id, proforma_id, 'MXN'::moneda FROM match_mxn
  ) m
  WHERE cv.embarque_id = m.embarque_id
    AND cv.moneda = m.moneda
    AND cv.proforma_id IS NULL
    AND cv.deleted_at IS NULL
    AND cv.estado_facturacion = 'pendiente';
END $$;