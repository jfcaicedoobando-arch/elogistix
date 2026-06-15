CREATE OR REPLACE FUNCTION public.bloquear_conceptos_en_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado::text INTO v_estado
  FROM public.embarques
  WHERE id = COALESCE(NEW.embarque_id, OLD.embarque_id);

  IF v_estado = 'Cerrado' THEN
    -- Permitir soft-delete (UPDATE que sólo marca deleted_at) sin importar el estado.
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RETURN NEW;
    END IF;

    -- Permitir exclusivamente el backfill administrativo legacy de auditoría.
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
$$;

CREATE OR REPLACE FUNCTION public.backfill_conceptos_venta_facturados()
RETURNS TABLE(organization_id uuid, conceptos_actualizados bigint, embarques_afectados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.auditoria_backfill_legacy', 'on', true);

  RETURN QUERY
  WITH candidatos AS (
    SELECT cv.id AS concepto_id,
           cv.embarque_id,
           e.organization_id
    FROM public.conceptos_venta cv
    JOIN public.embarques e ON e.id = cv.embarque_id
    WHERE cv.estado_facturacion = 'pendiente'
      AND e.estado IN ('Entregado','Cerrado')
      AND EXISTS (
        SELECT 1
        FROM public.facturas f
        WHERE f.embarque_id = cv.embarque_id
          AND f.estado IN ('Emitida','Pagada','Parcialmente pagada')
      )
  ), actualizados AS (
    UPDATE public.conceptos_venta cv
       SET estado_facturacion = 'facturado'
      FROM candidatos c
     WHERE cv.id = c.concepto_id
    RETURNING cv.id, c.embarque_id, c.organization_id
  )
  SELECT a.organization_id,
         COUNT(*)::bigint AS conceptos_actualizados,
         COUNT(DISTINCT a.embarque_id)::bigint AS embarques_afectados
  FROM actualizados a
  GROUP BY a.organization_id;

  PERFORM set_config('app.auditoria_backfill_legacy', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_conceptos_venta_facturados() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_proformas_aceptadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_auditoria_backfill_legacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_conceptos_venta_facturados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_proformas_aceptadas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_auditoria_backfill_legacy() TO authenticated, service_role;