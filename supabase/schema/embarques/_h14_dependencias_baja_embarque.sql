-- One SQL snapshot for preview/counts/examples. The VOLATILE call is issued
-- after the mutex/row lock by the final validators, so it does not inherit the
-- initiating DML statement's pre-wait snapshot.
CREATE OR REPLACE FUNCTION public._h14_dependencias_baja_embarque(p_embarque_id uuid, p_org uuid, p_ejemplos boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_incoherente boolean;
BEGIN
  WITH emb AS MATERIALIZED (
    SELECT id, expediente, estado, cerrado_at FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = p_org
  ), proforma_ids AS MATERIALIZED (
    SELECT public._h14_proformas_baja_embarque(p_embarque_id, p_org) AS ids
  ), factura_ids AS MATERIALIZED (
    SELECT public._h14_facturas_baja_embarque(p_embarque_id, p_org, p.ids) AS ids FROM proforma_ids p
  ), cxp_ids AS MATERIALIZED (
    SELECT public._h14_cxp_baja_embarque(p_embarque_id, p_org) AS ids
  ), proformas_ajenas_directas AS MATERIALIZED (
    -- Resolve structural candidates before invoking their financial-state helpers.
    SELECT p.* FROM public.proformas p
    WHERE p.organization_id IS DISTINCT FROM p_org
      AND (p.embarque_id = p_embarque_id
        OR p_embarque_id = ANY(COALESCE(p.embarques_ids, ARRAY[]::uuid[])))
  ), proformas_ajenas_padres AS MATERIALIZED (
    SELECT padre.* FROM public.proformas padre, proforma_ids ids
    WHERE padre.organization_id IS DISTINCT FROM p_org
      AND (COALESCE(padre.proformas_origen, ARRAY[]::uuid[]) && ids.ids
        OR padre.id IN (SELECT p.consolidada_en FROM public.proformas p WHERE p.id = ANY(ids.ids)))
  ), facturas_ajenas_proformas AS MATERIALIZED (
    SELECT f.id, f.organization_id FROM public.facturas f, proforma_ids ids
    WHERE f.organization_id IS DISTINCT FROM p_org
      AND (f.proforma_id = ANY(ids.ids)
        OR EXISTS (SELECT 1 FROM public.proformas p WHERE p.id = ANY(ids.ids)
          AND f.id IN (p.factura_id, p.factura_secundaria_id))
        OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
          AND cf.deleted_at IS NULL AND cf.proforma_id_origen = ANY(ids.ids)))
  ), motivos AS MATERIALIZED (
    SELECT
      (SELECT count(*) FROM public.facturas f, factura_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada', 'Sustituida')) AS facturas,
      (SELECT count(*) FROM public.proveedor_facturas f, cxp_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL) AS cxp,
      (SELECT count(*) FROM public.pagos_factura p, factura_ids ids
        WHERE (p.factura_id = ANY(ids.ids) OR p.embarque_id = p_embarque_id)
          AND p.organization_id = p_org AND p.deleted_at IS NULL) AS pagos_cxc,
      (SELECT count(*) FROM public.pagos_proveedor p, cxp_ids ids
        WHERE p.proveedor_factura_id = ANY(ids.ids) AND p.organization_id = p_org AND p.deleted_at IS NULL) AS pagos_cxp,
      (SELECT count(*) FROM public.factura_notas_credito n, factura_ids ids
        WHERE n.factura_id = ANY(ids.ids) AND n.organization_id = p_org AND n.deleted_at IS NULL) AS notas_credito_cxc,
      (SELECT count(*) FROM public.proveedor_notas_credito n, cxp_ids ids
        WHERE n.proveedor_factura_id = ANY(ids.ids) AND n.organization_id = p_org AND n.deleted_at IS NULL) AS notas_credito_cxp,
      (SELECT count(*) FROM public.comisiones_devengadas c
        WHERE c.embarque_id = p_embarque_id AND c.organization_id = p_org AND c.definitiva IS TRUE) AS comisiones_definitivas,
      (SELECT count(*) FROM public.proformas p, proforma_ids ids
        WHERE p.id = ANY(ids.ids) AND p.organization_id = p_org AND p.deleted_at IS NULL
          AND COALESCE(p.estado_proforma, 'pendiente') NOT IN ('cancelada', 'facturada')) AS proformas
  ), incoherencia AS (
    -- Simple-ID historical FKs are not composite tenant constraints. Do not
    -- turn an invalid active reference into "no dependency" by filtering it
    -- out of the tenant-safe result. Only this boolean is consumed; no foreign
    -- ID, amount, folio or count becomes part of the public payload.
    SELECT
      EXISTS (SELECT 1 FROM public.facturas f WHERE f.embarque_id = p_embarque_id
        AND f.organization_id IS DISTINCT FROM p_org
        AND public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))
      OR EXISTS (SELECT 1 FROM proformas_ajenas_directas p WHERE
        (public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p))
          OR EXISTS (SELECT 1 FROM public.facturas f WHERE
            (f.proforma_id = p.id OR f.id IN (p.factura_id, p.factura_secundaria_id)
              OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
                AND cf.proforma_id_origen = p.id AND cf.deleted_at IS NULL))
            AND public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))))
      OR EXISTS (SELECT 1 FROM proformas_ajenas_padres padre
        WHERE public._h14_fila_bloqueante_baja(padre.organization_id, 'proformas', to_jsonb(padre)))
      OR EXISTS (SELECT 1 FROM facturas_ajenas_proformas f
        WHERE public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id))
      OR EXISTS (SELECT 1 FROM public.comisiones_devengadas c WHERE c.embarque_id = p_embarque_id
        AND c.organization_id IS DISTINCT FROM p_org AND c.definitiva IS TRUE)
      OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.embarque_id = p_embarque_id
        AND p.organization_id IS DISTINCT FROM p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.pagos_factura p JOIN public.facturas f ON f.id = p.factura_id, factura_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND p.deleted_at IS NULL
          AND (p.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.factura_notas_credito n JOIN public.facturas f ON f.id = n.factura_id, factura_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND n.deleted_at IS NULL
          AND (n.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.pagos_proveedor p JOIN public.proveedor_facturas f ON f.id = p.proveedor_factura_id, cxp_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND p.deleted_at IS NULL
          AND (p.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n JOIN public.proveedor_facturas f ON f.id = n.proveedor_factura_id, cxp_ids ids
        WHERE (f.id = ANY(ids.ids) OR f.embarque_id = p_embarque_id) AND n.deleted_at IS NULL
          AND (n.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org))
      OR EXISTS (SELECT 1 FROM public.factura_embarques fe JOIN public.facturas f ON f.id = fe.factura_id
        WHERE fe.embarque_id = p_embarque_id AND fe.activa IS TRUE
          AND (fe.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND (public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id)
            OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.deleted_at IS NULL)))
      OR EXISTS (SELECT 1 FROM public.conceptos_factura cf JOIN public.facturas f ON f.id = cf.factura_id, proforma_ids ids
        WHERE (cf.embarque_id = p_embarque_id OR cf.proforma_id_origen = ANY(ids.ids)) AND cf.deleted_at IS NULL
          AND (cf.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND (public._h14_documento_bloqueante_baja(f.organization_id, 'facturas', f.id)
            OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.deleted_at IS NULL)))
      OR EXISTS (SELECT 1 FROM public.proforma_conceptos_consolidados pc JOIN public.proformas p ON p.id = pc.proforma_id
        WHERE pc.embarque_id = p_embarque_id AND pc.deleted_at IS NULL
          AND (pc.organization_id IS DISTINCT FROM p_org OR p.organization_id IS DISTINCT FROM p_org)
          AND public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p)))
      OR EXISTS (SELECT 1 FROM public.conceptos_venta cv JOIN public.proformas p ON p.id = cv.proforma_id
        WHERE cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL
          AND (cv.organization_id IS DISTINCT FROM p_org OR p.organization_id IS DISTINCT FROM p_org)
          AND public._h14_fila_bloqueante_baja(p.organization_id, 'proformas', to_jsonb(p)))
      OR EXISTS (SELECT 1 FROM public.embarque_facturas_entrantes e JOIN public.proveedor_facturas f ON f.id = e.proveedor_factura_id
        WHERE e.embarque_id = p_embarque_id AND e.deleted_at IS NULL
          AND (e.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND public._h14_documento_bloqueante_baja(f.organization_id, 'proveedor_facturas', f.id))
      OR EXISTS (SELECT 1 FROM public.embarque_garantias_contenedor g JOIN public.proveedor_facturas f ON f.id = g.proveedor_factura_id
        WHERE g.embarque_id = p_embarque_id AND g.deleted_at IS NULL
          AND (g.organization_id IS DISTINCT FROM p_org OR f.organization_id IS DISTINCT FROM p_org)
          AND public._h14_documento_bloqueante_baja(f.organization_id, 'proveedor_facturas', f.id)) AS presente
  )
  SELECT jsonb_build_object(
    'version', 1, 'embarque_id', p_embarque_id,
    'expediente', COALESCE(NULLIF(btrim(COALESCE(e.expediente, '')), ''), 'Borrador ' || right(p_embarque_id::text, 6)),
    'facturas', m.facturas, 'cxp', m.cxp, 'pagos_cxc', m.pagos_cxc, 'pagos_cxp', m.pagos_cxp,
    'notas_credito_cxc', m.notas_credito_cxc, 'notas_credito_cxp', m.notas_credito_cxp,
    'comisiones_definitivas', m.comisiones_definitivas, 'proformas', m.proformas,
    'cerrado', e.estado = 'Cerrado' OR e.cerrado_at IS NOT NULL,
    'bloqueado', m.facturas > 0 OR m.cxp > 0 OR m.pagos_cxc > 0 OR m.pagos_cxp > 0
      OR m.notas_credito_cxc > 0 OR m.notas_credito_cxp > 0 OR m.comisiones_definitivas > 0
      OR m.proformas > 0 OR e.estado = 'Cerrado' OR e.cerrado_at IS NOT NULL,
    'ejemplos_cxc', CASE WHEN p_ejemplos IS TRUE THEN (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.folio NULLS LAST, x.id), '[]'::jsonb)
      FROM (SELECT f.id, f.numero AS folio, f.estado::text AS estado
        FROM public.facturas f, factura_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada', 'Sustituida')
        ORDER BY f.numero NULLS LAST, f.id LIMIT 20) x) ELSE '[]'::jsonb END,
    'ejemplos_cxp', CASE WHEN p_ejemplos IS TRUE THEN (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.folio NULLS LAST, x.id), '[]'::jsonb)
      FROM (SELECT f.id, f.folio_proveedor AS folio, f.estado::text AS estado
        FROM public.proveedor_facturas f, cxp_ids ids
        WHERE f.id = ANY(ids.ids) AND f.organization_id = p_org AND f.deleted_at IS NULL
        ORDER BY f.folio_proveedor NULLS LAST, f.id LIMIT 20) x) ELSE '[]'::jsonb END)
  , i.presente INTO v_result, v_incoherente
  FROM emb e CROSS JOIN motivos m CROSS JOIN incoherencia i;
  IF v_incoherente IS TRUE THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_dependencias_baja_embarque(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
