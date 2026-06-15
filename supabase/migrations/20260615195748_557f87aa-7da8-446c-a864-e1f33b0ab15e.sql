-- Backfill helpers para Auditoría operativa (v13.21.27)
-- Repara estado_facturacion / proformas.estado en embarques legacy.

CREATE OR REPLACE FUNCTION public.backfill_conceptos_venta_facturados()
RETURNS TABLE(organization_id uuid, conceptos_actualizados bigint, embarques_afectados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT cv.id AS concepto_id,
           cv.embarque_id,
           e.organization_id,
           (
             SELECT f.id FROM public.facturas f
             WHERE f.embarque_id = cv.embarque_id
               AND f.estado IN ('emitida','pagada','parcial','timbrada')
             ORDER BY f.fecha_emision DESC NULLS LAST, f.created_at DESC
             LIMIT 1
           ) AS factura_id
    FROM public.conceptos_venta cv
    JOIN public.embarques e ON e.id = cv.embarque_id
    WHERE cv.estado_facturacion = 'pendiente'
      AND e.estado IN ('Entregado','Cerrado')
      AND EXISTS (
        SELECT 1 FROM public.facturas f2
        WHERE f2.embarque_id = cv.embarque_id
          AND f2.estado IN ('emitida','pagada','parcial','timbrada')
      )
  ), actualizados AS (
    UPDATE public.conceptos_venta cv
       SET estado_facturacion = 'facturado',
           factura_id = c.factura_id
      FROM candidatos c
     WHERE cv.id = c.concepto_id
    RETURNING cv.id, c.embarque_id, c.organization_id
  )
  SELECT a.organization_id,
         COUNT(*)::bigint AS conceptos_actualizados,
         COUNT(DISTINCT a.embarque_id)::bigint AS embarques_afectados
  FROM actualizados a
  GROUP BY a.organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_proformas_aceptadas()
RETURNS TABLE(organization_id uuid, proformas_actualizadas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH actualizadas AS (
    UPDATE public.proformas p
       SET estado = 'facturada'
      FROM public.embarques e
     WHERE p.embarque_id = e.id
       AND p.estado IN ('borrador','enviada','aceptada')
       AND EXISTS (
         SELECT 1 FROM public.facturas f
         WHERE f.embarque_id = p.embarque_id
           AND f.estado IN ('emitida','pagada','parcial','timbrada')
       )
    RETURNING p.id, e.organization_id
  )
  SELECT a.organization_id, COUNT(*)::bigint
  FROM actualizadas a
  GROUP BY a.organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_auditoria_backfill_legacy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_conceptos jsonb;
  v_proformas jsonb;
  v_tot_conceptos bigint := 0;
  v_tot_embarques bigint := 0;
  v_tot_proformas bigint := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_caller, 'super_admin') THEN
    RAISE EXCEPTION 'Solo super_admin puede ejecutar este backfill' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'organization_id', organization_id,
           'conceptos', conceptos_actualizados,
           'embarques', embarques_afectados
         )), '[]'::jsonb),
         COALESCE(SUM(conceptos_actualizados), 0),
         COALESCE(SUM(embarques_afectados), 0)
    INTO v_conceptos, v_tot_conceptos, v_tot_embarques
  FROM public.backfill_conceptos_venta_facturados();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'organization_id', organization_id,
           'proformas', proformas_actualizadas
         )), '[]'::jsonb),
         COALESCE(SUM(proformas_actualizadas), 0)
    INTO v_proformas, v_tot_proformas
  FROM public.backfill_proformas_aceptadas();

  RETURN jsonb_build_object(
    'ejecutado_at', now(),
    'ejecutado_por', v_caller,
    'totales', jsonb_build_object(
      'conceptos_actualizados', v_tot_conceptos,
      'embarques_afectados', v_tot_embarques,
      'proformas_actualizadas', v_tot_proformas
    ),
    'por_organizacion_conceptos', v_conceptos,
    'por_organizacion_proformas', v_proformas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_conceptos_venta_facturados() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_proformas_aceptadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_auditoria_backfill_legacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_auditoria_backfill_legacy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_conceptos_venta_facturados() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_proformas_aceptadas() TO service_role;