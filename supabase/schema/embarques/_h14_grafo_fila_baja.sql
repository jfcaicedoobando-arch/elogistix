-- Private read helpers. STABLE preserves the statement snapshot; writers call
-- them only after the org mutex, and candidate records overlay changed links.
CREATE OR REPLACE FUNCTION public._h14_documento_bloqueante_baja(p_org uuid, p_tipo text, p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT CASE p_tipo
    WHEN 'facturas' THEN EXISTS (SELECT 1 FROM public.facturas f WHERE f.id = p_id AND f.organization_id = p_org
      AND ((f.deleted_at IS NULL AND f.estado NOT IN ('Cancelada', 'Sustituida'))
        OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = f.id AND p.organization_id = p_org AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = f.id AND n.organization_id = p_org AND n.deleted_at IS NULL)))
    WHEN 'proveedor_facturas' THEN EXISTS (SELECT 1 FROM public.proveedor_facturas f WHERE f.id = p_id AND f.organization_id = p_org
      AND (f.deleted_at IS NULL
        OR EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.proveedor_factura_id = f.id AND p.organization_id = p_org AND p.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n WHERE n.proveedor_factura_id = f.id AND n.organization_id = p_org AND n.deleted_at IS NULL)))
    ELSE false END;
$function$;
REVOKE ALL ON FUNCTION public._h14_documento_bloqueante_baja(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._h14_grafo_fila_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := (p_fila->>'id')::uuid;
  v_targets uuid[] := ARRAY[]::uuid[];
  v_direct uuid[] := ARRAY[]::uuid[];
  v_parent jsonb;
  v_parent_id uuid;
  v_proformas uuid[];
  v_extra uuid[];
BEGIN
  IF p_fila IS NULL THEN RETURN v_targets; END IF;
  v_direct := ARRAY[(p_fila->>'embarque_id')::uuid];
  IF p_tabla = 'embarques' THEN v_direct := ARRAY[v_id]; END IF;
  SELECT v_direct || COALESCE(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_direct
  FROM jsonb_array_elements_text(COALESCE(NULLIF(p_fila->'embarques_ids', 'null'::jsonb), '[]'::jsonb)) AS a(x);

  IF p_tabla = 'proformas' THEN
    -- Follow sources downwards, using the candidate's complete row instead of
    -- its old stored header/arrays. Never expand unrelated sibling sources.
    WITH RECURSIVE filas AS MATERIALIZED (
      SELECT p.* FROM public.proformas p WHERE p.organization_id = p_org AND p.id IS DISTINCT FROM v_id
      UNION ALL SELECT (jsonb_populate_record(NULL::public.proformas, p_fila)).*
    ), fuentes(id) AS (
      SELECT v_id
      UNION
      SELECT hijo.id FROM fuentes r JOIN filas padre ON padre.id = r.id
      JOIN filas hijo ON hijo.organization_id = p_org
        AND (hijo.consolidada_en = padre.id OR hijo.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
    ), targets AS (
      SELECT p.embarque_id AS id FROM filas p JOIN fuentes s ON s.id = p.id
      UNION SELECT unnest(COALESCE(p.embarques_ids, ARRAY[]::uuid[])) FROM filas p JOIN fuentes s ON s.id = p.id
      UNION SELECT pc.embarque_id FROM public.proforma_conceptos_consolidados pc JOIN fuentes s ON s.id = pc.proforma_id
        WHERE pc.organization_id = p_org AND pc.deleted_at IS NULL
      UNION SELECT cv.embarque_id FROM public.conceptos_venta cv JOIN fuentes s ON s.id = cv.proforma_id
        WHERE cv.organization_id = p_org AND cv.deleted_at IS NULL
    ) SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM targets;
  ELSIF p_tabla = 'facturas' THEN
    SELECT COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_proformas FROM (
      SELECT (p_fila->>'proforma_id')::uuid AS id
      UNION SELECT cf.proforma_id_origen FROM public.conceptos_factura cf
        WHERE cf.factura_id = v_id AND cf.organization_id = p_org AND cf.deleted_at IS NULL
      UNION SELECT p.id FROM public.proformas p WHERE p.organization_id = p_org
        AND v_id IN (p.factura_id, p.factura_secundaria_id)
    ) q;
    SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM (
      SELECT unnest(v_direct) AS id
      UNION SELECT fe.embarque_id FROM public.factura_embarques fe
        WHERE fe.factura_id = v_id AND fe.organization_id = p_org AND fe.activa IS TRUE
      UNION SELECT cf.embarque_id FROM public.conceptos_factura cf
        WHERE cf.factura_id = v_id AND cf.organization_id = p_org AND cf.deleted_at IS NULL
    ) q;
    -- Invert the directed lineage from the invoice's proforma roots. A source
    -- reaches a root through consolidada_en or the parent's proformas_origen.
    -- Do not call the per-shipment resolver across every shipment in the org.
    IF cardinality(v_proformas) > 0 THEN
      WITH RECURSIVE familia(id) AS (
        SELECT p.id FROM public.proformas p
        WHERE p.organization_id = p_org AND p.id = ANY(v_proformas)
        UNION
        SELECT hijo.id FROM familia r
        JOIN public.proformas padre ON padre.id = r.id AND padre.organization_id = p_org
        JOIN public.proformas hijo ON hijo.organization_id = p_org
          AND (hijo.consolidada_en = padre.id
            OR hijo.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
      ), anclas(id) AS (
        SELECT p.embarque_id FROM public.proformas p JOIN familia f ON f.id = p.id
          WHERE p.organization_id = p_org
        UNION SELECT unnest(COALESCE(p.embarques_ids, ARRAY[]::uuid[]))
          FROM public.proformas p JOIN familia f ON f.id = p.id WHERE p.organization_id = p_org
        UNION SELECT pc.embarque_id FROM public.proforma_conceptos_consolidados pc
          JOIN familia f ON f.id = pc.proforma_id
          WHERE pc.organization_id = p_org AND pc.deleted_at IS NULL
        UNION SELECT cv.embarque_id FROM public.conceptos_venta cv JOIN familia f ON f.id = cv.proforma_id
          WHERE cv.organization_id = p_org AND cv.deleted_at IS NULL
      )
      SELECT COALESCE(array_agg(DISTINCT e.id ORDER BY e.id), ARRAY[]::uuid[]) INTO v_extra
      FROM anclas a JOIN public.embarques e ON e.id = a.id AND e.organization_id = p_org;
      v_targets := v_targets || v_extra;
    END IF;
  ELSIF p_tabla = 'proveedor_facturas' THEN
    SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM (
      SELECT unnest(v_direct) AS id
      UNION SELECT cc.embarque_id FROM public.proveedor_facturas_conceptos pc
        JOIN public.conceptos_costo cc ON cc.id = pc.concepto_costo_id AND cc.organization_id = p_org
        WHERE pc.proveedor_factura_id = v_id AND pc.organization_id = p_org
      UNION SELECT s.embarque_id FROM public.seguros_embarque s
        WHERE s.proveedor_factura_id = v_id AND s.organization_id = p_org AND s.deleted_at IS NULL
      UNION SELECT d.embarque_id FROM public.embarque_facturas_entrantes d
        WHERE d.proveedor_factura_id = v_id AND d.organization_id = p_org AND d.deleted_at IS NULL
      UNION SELECT g.embarque_id FROM public.embarque_garantias_contenedor g
        WHERE g.proveedor_factura_id = v_id AND g.organization_id = p_org AND g.deleted_at IS NULL
    ) q;
  ELSE
    v_targets := v_direct;
    IF p_tabla IN ('factura_embarques', 'conceptos_factura', 'pagos_factura', 'factura_notas_credito') THEN
      SELECT to_jsonb(f) INTO v_parent FROM public.facturas f
        WHERE f.id = (p_fila->>'factura_id')::uuid AND f.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'facturas', v_parent);
    ELSIF p_tabla IN ('proveedor_facturas_conceptos', 'pagos_proveedor', 'proveedor_notas_credito',
      'seguros_embarque', 'embarque_facturas_entrantes', 'embarque_garantias_contenedor') THEN
      SELECT to_jsonb(f) INTO v_parent FROM public.proveedor_facturas f
        WHERE f.id = (p_fila->>'proveedor_factura_id')::uuid AND f.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proveedor_facturas', v_parent);
    END IF;
    IF p_tabla IN ('conceptos_venta', 'proforma_conceptos_consolidados', 'conceptos_factura') THEN
      v_parent_id := CASE WHEN p_tabla = 'conceptos_factura' THEN (p_fila->>'proforma_id_origen')::uuid ELSE (p_fila->>'proforma_id')::uuid END;
      SELECT to_jsonb(p) INTO v_parent FROM public.proformas p WHERE p.id = v_parent_id AND p.organization_id = p_org;
      v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proformas', v_parent);
    END IF;
    IF p_tabla = 'proveedor_facturas_conceptos' THEN
      SELECT ARRAY[cc.embarque_id] INTO v_extra FROM public.conceptos_costo cc
        WHERE cc.id = (p_fila->>'concepto_costo_id')::uuid AND cc.organization_id = p_org;
      v_targets := v_targets || COALESCE(v_extra, ARRAY[]::uuid[]);
    ELSIF p_tabla = 'conceptos_costo' THEN
      FOR v_parent IN SELECT to_jsonb(f) FROM public.proveedor_facturas f
        JOIN public.proveedor_facturas_conceptos pc ON pc.proveedor_factura_id = f.id AND pc.organization_id = p_org
        WHERE pc.concepto_costo_id = v_id AND f.organization_id = p_org
      LOOP v_targets := v_targets || public._h14_grafo_fila_baja(p_org, 'proveedor_facturas', v_parent); END LOOP;
    END IF;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) INTO v_targets FROM unnest(v_targets) AS u(id);
  RETURN v_targets;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_grafo_fila_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._h14_fila_bloqueante_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := (p_fila->>'id')::uuid;
  v_parent jsonb;
  v_live boolean := p_fila->>'deleted_at' IS NULL;
  v_result boolean;
BEGIN
  IF p_fila IS NULL THEN RETURN false; END IF;
  CASE p_tabla
    WHEN 'facturas' THEN RETURN (v_live AND COALESCE(p_fila->>'estado', '') NOT IN ('Cancelada', 'Sustituida'))
      OR EXISTS (SELECT 1 FROM public.pagos_factura p WHERE p.factura_id = v_id AND p.organization_id = p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.factura_notas_credito n WHERE n.factura_id = v_id AND n.organization_id = p_org AND n.deleted_at IS NULL);
    WHEN 'proveedor_facturas' THEN RETURN v_live
      OR EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.proveedor_factura_id = v_id AND p.organization_id = p_org AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito n WHERE n.proveedor_factura_id = v_id AND n.organization_id = p_org AND n.deleted_at IS NULL);
    WHEN 'factura_embarques' THEN RETURN COALESCE((p_fila->>'activa')::boolean, false)
      AND public._h14_documento_bloqueante_baja(p_org, 'facturas', (p_fila->>'factura_id')::uuid);
    WHEN 'conceptos_factura' THEN RETURN v_live
      AND public._h14_documento_bloqueante_baja(p_org, 'facturas', (p_fila->>'factura_id')::uuid);
    WHEN 'proveedor_facturas_conceptos' THEN RETURN public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', (p_fila->>'proveedor_factura_id')::uuid);
    WHEN 'seguros_embarque', 'embarque_facturas_entrantes', 'embarque_garantias_contenedor' THEN RETURN v_live
      AND public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', (p_fila->>'proveedor_factura_id')::uuid);
    WHEN 'pagos_factura', 'factura_notas_credito', 'pagos_proveedor', 'proveedor_notas_credito' THEN RETURN v_live;
    WHEN 'comisiones_devengadas' THEN RETURN COALESCE((p_fila->>'definitiva')::boolean, false);
    WHEN 'conceptos_costo' THEN RETURN EXISTS (SELECT 1 FROM public.proveedor_facturas_conceptos pc
      WHERE pc.concepto_costo_id = v_id AND pc.organization_id = p_org
        AND public._h14_documento_bloqueante_baja(p_org, 'proveedor_facturas', pc.proveedor_factura_id));
    WHEN 'conceptos_venta', 'proforma_conceptos_consolidados' THEN
      IF NOT v_live THEN RETURN false; END IF;
      SELECT to_jsonb(p) INTO v_parent FROM public.proformas p WHERE p.id = (p_fila->>'proforma_id')::uuid AND p.organization_id = p_org;
      RETURN public._h14_fila_bloqueante_baja(p_org, 'proformas', v_parent);
    WHEN 'proformas' THEN
      IF v_live AND COALESCE(p_fila->>'estado_proforma', 'pendiente') NOT IN ('cancelada', 'facturada') THEN RETURN true; END IF;
      WITH RECURSIVE filas AS MATERIALIZED (
        SELECT p.* FROM public.proformas p WHERE p.organization_id = p_org AND p.id IS DISTINCT FROM v_id
        UNION ALL SELECT (jsonb_populate_record(NULL::public.proformas, p_fila)).*
      ), ancestros(id) AS (
        SELECT v_id
        UNION
        SELECT padre.id FROM ancestros r JOIN filas fuente ON fuente.id = r.id
        JOIN filas padre ON padre.organization_id = p_org
          AND (fuente.consolidada_en = padre.id OR fuente.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
      ), facturas AS (
        SELECT f.id FROM public.facturas f WHERE f.organization_id = p_org
          AND (f.proforma_id IN (SELECT id FROM ancestros)
            OR EXISTS (SELECT 1 FROM public.conceptos_factura cf WHERE cf.factura_id = f.id
              AND cf.organization_id = p_org AND cf.deleted_at IS NULL AND cf.proforma_id_origen IN (SELECT id FROM ancestros))
            OR EXISTS (SELECT 1 FROM filas p WHERE p.id IN (SELECT id FROM ancestros) AND f.id IN (p.factura_id, p.factura_secundaria_id)))
      ) SELECT EXISTS (SELECT 1 FROM facturas f WHERE public._h14_documento_bloqueante_baja(p_org, 'facturas', f.id)) INTO v_result;
      RETURN v_result;
    ELSE RETURN false;
  END CASE;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_fila_bloqueante_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
