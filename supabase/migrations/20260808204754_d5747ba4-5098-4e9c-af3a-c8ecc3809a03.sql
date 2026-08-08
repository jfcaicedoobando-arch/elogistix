-- 1) Helper con la nueva regla
CREATE OR REPLACE FUNCTION public._audit_costos_repetidos(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH emb AS (
    SELECT e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
    FROM embarques e
    WHERE e.organization_id = p_organization_id
      AND e.deleted_at IS NULL
      AND e.estado::text <> 'Cancelado'
  ),
  n_conts AS (
    SELECT ec.embarque_id, COUNT(*) AS n
    FROM embarque_contenedores ec
    WHERE ec.deleted_at IS NULL
      AND ec.embarque_id IN (SELECT id FROM emb)
    GROUP BY ec.embarque_id
  ),
  grupos AS (
    SELECT cc.embarque_id, cc.concepto, cc.monto, cc.moneda::text AS moneda, COUNT(*) AS copias
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL
      AND cc.embarque_id IN (SELECT id FROM emb)
    GROUP BY cc.embarque_id, cc.concepto, cc.monto, cc.moneda, COALESCE(cc.contenedor_id::text, '-')
    HAVING COUNT(*) > 1
  ),
  sospechosos AS (
    SELECT g.embarque_id, COUNT(*) AS n_grupos, SUM(g.copias - 1) AS n_extras
    FROM grupos g
    LEFT JOIN n_conts nc ON nc.embarque_id = g.embarque_id
    WHERE g.copias <> COALESCE(nc.n, 0)
    GROUP BY g.embarque_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'embarque_id', e.id, 'expediente', e.expediente,
    'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
    'regla', 'costos_repetidos', 'severidad', 'alto',
    'detalle', s.n_grupos || ' grupo(s) de costos idénticos repetidos (' || s.n_extras ||
               ' renglón(es) de más) que no corresponden al número de contenedores; revisa si son duplicados',
    'documentos_faltantes', '[]'::jsonb
  )), '[]'::jsonb)
  FROM sospechosos s
  JOIN emb e ON e.id = s.embarque_id;
$$;

REVOKE ALL ON FUNCTION public._audit_costos_repetidos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._audit_costos_repetidos(uuid) TO authenticated, service_role;

-- 2) Contador de la nueva regla en el agregador
CREATE OR REPLACE FUNCTION public._audit_embarques_agregar(p_hallazgos jsonb, p_umbrales jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'generated_at', now(),
    'total_hallazgos', COUNT(*),
    'por_severidad', jsonb_build_object(
      'critico', COUNT(*) FILTER (WHERE h->>'severidad' = 'critico'),
      'alto',    COUNT(*) FILTER (WHERE h->>'severidad' = 'alto'),
      'medio',   COUNT(*) FILTER (WHERE h->>'severidad' = 'medio')
    ),
    'por_regla', jsonb_build_object(
      'docs_faltantes',                COUNT(*) FILTER (WHERE h->>'regla' = 'docs_faltantes'),
      'docs_pendientes_avanzado',      COUNT(*) FILTER (WHERE h->>'regla' = 'docs_pendientes_avanzado'),
      'fechas',                        COUNT(*) FILTER (WHERE h->>'regla' = 'fechas'),
      'ventas_sin_facturar',           COUNT(*) FILTER (WHERE h->>'regla' = 'ventas_sin_facturar'),
      'margen_negativo',               COUNT(*) FILTER (WHERE h->>'regla' = 'margen_negativo'),
      'margen_bajo',                   COUNT(*) FILTER (WHERE h->>'regla' = 'margen_bajo'),
      'venta_sin_costo',               COUNT(*) FILTER (WHERE h->>'regla' = 'venta_sin_costo'),
      'costo_sin_venta',               COUNT(*) FILTER (WHERE h->>'regla' = 'costo_sin_venta'),
      'costos_repetidos',              COUNT(*) FILTER (WHERE h->>'regla' = 'costos_repetidos'),
      'proforma_vencida',              COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_vencida'),
      'proforma_borrador_abandonada',  COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_borrador_abandonada'),
      'proforma_inconsistente',        COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_inconsistente'),
      'embarque_huerfano',             COUNT(*) FILTER (WHERE h->>'regla' = 'embarque_huerfano'),
      'factura_sin_timbrar',           COUNT(*) FILTER (WHERE h->>'regla' = 'factura_sin_timbrar'),
      'rep_pendiente',                 COUNT(*) FILTER (WHERE h->>'regla' = 'rep_pendiente'),
      'factura_cancelada_sin_sustitucion', COUNT(*) FILTER (WHERE h->>'regla' = 'factura_cancelada_sin_sustitucion'),
      'cxc_vencida',                   COUNT(*) FILTER (WHERE h->>'regla' = 'cxc_vencida'),
      'cxp_por_capturar_estancada',    COUNT(*) FILTER (WHERE h->>'regla' = 'cxp_por_capturar_estancada'),
      'cxp_vencida',                   COUNT(*) FILTER (WHERE h->>'regla' = 'cxp_vencida'),
      'contenedor_datos_incompletos',  COUNT(*) FILTER (WHERE h->>'regla' = 'contenedor_datos_incompletos'),
      'contenedor_fechas_incompletas', COUNT(*) FILTER (WHERE h->>'regla' = 'contenedor_fechas_incompletas'),
      'tipo_cambio_faltante',          COUNT(*) FILTER (WHERE h->>'regla' = 'tipo_cambio_faltante')
    ),
    'umbrales', p_umbrales,
    'hallazgos', COALESCE(jsonb_agg(h ORDER BY
      CASE h->>'severidad' WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 ELSE 3 END,
      h->>'expediente'
    ), '[]'::jsonb)
  )
  FROM jsonb_array_elements(COALESCE(p_hallazgos, '[]'::jsonb)) AS t(h);
$$;

-- 3) La función grande pasa a ser base; el nombre público la envuelve y agrega la nueva regla
ALTER FUNCTION public.auditoria_embarques_org(uuid) RENAME TO _auditoria_embarques_org_base;

CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_base jsonb;
  v_extras jsonb;
BEGIN
  v_base := public._auditoria_embarques_org_base(p_organization_id);
  v_extras := public._audit_costos_repetidos(p_organization_id);

  IF v_extras IS NULL OR jsonb_array_length(v_extras) = 0 THEN
    RETURN v_base;
  END IF;

  RETURN public._audit_embarques_agregar(
    COALESCE(v_base->'hallazgos', '[]'::jsonb) || v_extras,
    COALESCE(v_base->'umbrales', '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.auditoria_embarques_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._auditoria_embarques_org_base(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auditoria_embarques_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._auditoria_embarques_org_base(uuid) TO authenticated, service_role;